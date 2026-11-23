"""Memrly account verification and revocable sessions. No Google login."""
import hashlib
import hmac
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import UUID, uuid4

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from .config import settings
from .database import get_conn
from .security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/account", tags=["account"])
COOKIE = "memrly_session"
log = logging.getLogger(__name__)


def digest(value: str) -> str:
    return hmac.new(settings()["jwt"].encode(), value.encode(), hashlib.sha256).hexdigest()


def now_utc():
    return datetime.now(timezone.utc)


def require_same_origin(request: Request):
    # Session-changing cookie requests must originate from this HTTPS origin.
    origin = request.headers.get("origin")
    if not origin or origin.rstrip("/") != str(request.base_url).rstrip("/"):
        # Behind a reverse proxy, use the explicitly configured public origin.
        expected = settings()["public_origin"].rstrip("/")
        if origin != expected:
            raise HTTPException(403, "Origen de solicitud no permitido.")


def send_code(email: str, code: str, purpose: str):
    cfg = settings()
    if not all((cfg["smtp_host"], cfg["smtp_from"], cfg["smtp_user"], cfg["smtp_password"])):
        raise HTTPException(503, "El correo de verificación todavía no está configurado.")
    msg = EmailMessage()
    msg["From"] = cfg["smtp_from"]
    msg["To"] = email
    msg["Subject"] = "Memrly · Verifica tu correo" if purpose == "verify" else "Memrly · Recupera tu cuenta"
    msg.set_content(
        f"Tu código de Memrly es: {code}\nCaduca en 10 minutos. "
        "Si no lo has solicitado, ignora este correo."
    )
    with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"], timeout=10) as server:
        server.starttls()
        server.login(cfg["smtp_user"], cfg["smtp_password"])
        server.send_message(msg)


def issue_code(cur, uid: UUID, email: str, purpose: str):
    cur.execute(
        """SELECT created_at FROM account_codes
           WHERE user_id=%s AND purpose=%s ORDER BY created_at DESC LIMIT 1""",
        (uid, purpose),
    )
    last = cur.fetchone()
    if last and last["created_at"] > now_utc() - timedelta(seconds=60):
        raise HTTPException(429, "Espera un minuto antes de solicitar otro código.")
    code = f"{secrets.randbelow(1000000):06d}"
    cur.execute(
        """INSERT INTO account_codes(user_id,purpose,code_hash,expires_at)
           VALUES (%s,%s,%s,%s)""",
        (uid, purpose, digest(code), now_utc() + timedelta(minutes=10)),
    )
    send_code(email, code, purpose)


def validate_code(cur, uid: UUID, purpose: str, code: str):
    cur.execute(
        """SELECT id,code_hash,expires_at,attempts FROM account_codes
           WHERE user_id=%s AND purpose=%s AND consumed_at IS NULL
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE""",
        (uid, purpose),
    )
    row = cur.fetchone()
    if not row or row["expires_at"] < now_utc() or row["attempts"] >= 5:
        raise HTTPException(400, "Código incorrecto o caducado.")
    if not hmac.compare_digest(row["code_hash"], digest(code)):
        cur.execute("UPDATE account_codes SET attempts=attempts+1 WHERE id=%s", (row["id"],))
        return False
    cur.execute("UPDATE account_codes SET consumed_at=now() WHERE id=%s", (row["id"],))
    return True


class Register(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=12, max_length=128)
    repeat_password: str


class Credentials(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class EmailOnly(BaseModel):
    email: EmailStr


class Verify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class Reset(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=12, max_length=128)
    repeat_password: str


def user_by_email(cur, email: EmailStr):
    cur.execute(
        "SELECT id,email,password_hash,display_name,email_verified_at FROM app_users "
        "WHERE email=%s AND disabled_at IS NULL",
        (str(email).strip().lower(),),
    )
    return cur.fetchone()


@router.post("/register", status_code=201)
def register(data: Register, conn=Depends(get_conn)):
    if not settings()["allow_signup"]:
        raise HTTPException(403, "Registro desactivado.")
    if data.password != data.repeat_password:
        raise HTTPException(422, "Las contraseñas no coinciden.")
    uid, aid = uuid4(), uuid4()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO app_users(id,email,password_hash,display_name) VALUES (%s,%s,%s,%s)",
                (uid, str(data.email).lower(), hash_password(data.password), data.display_name.strip()),
            )
            cur.execute("INSERT INTO albums(id,name,created_by) VALUES (%s,'Mi álbum',%s)", (aid, uid))
            cur.execute("INSERT INTO album_members(album_id,user_id,role) VALUES (%s,%s,'owner')", (aid, uid))
            issue_code(cur, uid, str(data.email), "verify")
        conn.commit()
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(409, "Ya existe una cuenta con este correo.")
    return {"message": "Te hemos enviado un código para verificar tu correo."}


@router.post("/resend")
def resend(data: EmailOnly, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        user = user_by_email(cur, data.email)
        if user and not user["email_verified_at"]:
            issue_code(cur, user["id"], str(data.email), "verify")
    conn.commit()
    return {"message": "Si la cuenta está pendiente, recibirás un código."}


@router.post("/verify")
def verify(data: Verify, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        user = user_by_email(cur, data.email)
        if not user:
            raise HTTPException(400, "Código incorrecto o caducado.")
        good = validate_code(cur, user["id"], "verify", data.code)
        if good:
            cur.execute("UPDATE app_users SET email_verified_at=now() WHERE id=%s", (user["id"],))
    conn.commit()
    if not good:
        raise HTTPException(400, "Código incorrecto o caducado.")
    return {"message": "Correo verificado. Ya puedes iniciar sesión."}


def start_session(cur, uid: UUID, response: Response, remember: bool):
    token = secrets.token_urlsafe(48)
    seconds = 30 * 24 * 3600 if remember else 12 * 3600
    cur.execute(
        """INSERT INTO device_sessions(user_id,device_name,refresh_token_hash,expires_at)
           VALUES (%s,%s,%s,%s)""",
        (uid, "Memrly web", digest(token), now_utc() + timedelta(seconds=seconds)),
    )
    response.set_cookie(
        COOKIE, token, httponly=True, secure=True, samesite="strict",
        path="/api/v1/account", max_age=seconds if remember else None,
    )
    return {"access_token": create_token(uid), "token_type": "bearer", "expires_in": 43200}


@router.post("/login")
def login(data: Credentials, response: Response, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        user = user_by_email(cur, data.email)
        valid = verify_password(data.password, user["password_hash"] if user else None)
        if not valid or not user:
            raise HTTPException(401, "Correo o contraseña incorrectos.")
        if not user["email_verified_at"]:
            raise HTTPException(403, "Verifica tu dirección de correo antes de entrar.")
        result = start_session(cur, user["id"], response, data.remember)
    conn.commit()
    return result


@router.post("/refresh")
def refresh(request: Request, response: Response, conn=Depends(get_conn)):
    require_same_origin(request)
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "No hay sesión activa.")
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id,user_id,expires_at FROM device_sessions
               WHERE refresh_token_hash=%s AND revoked_at IS NULL FOR UPDATE""",
            (digest(token),),
        )
        session = cur.fetchone()
        if not session or session["expires_at"] <= now_utc():
            raise HTTPException(401, "Sesión caducada.")
        cur.execute("SELECT 1 FROM app_users WHERE id=%s AND disabled_at IS NULL AND email_verified_at IS NOT NULL",
                    (session["user_id"],))
        if not cur.fetchone():
            raise HTTPException(401, "Cuenta no disponible.")
        new_token = secrets.token_urlsafe(48)
        cur.execute("UPDATE device_sessions SET refresh_token_hash=%s WHERE id=%s",
                    (digest(new_token), session["id"]))
        seconds_left = int((session["expires_at"] - now_utc()).total_seconds())
        response.set_cookie(
            COOKIE, new_token, httponly=True, secure=True, samesite="strict",
            path="/api/v1/account", max_age=seconds_left if seconds_left > 12 * 3600 else None,
        )
        result = {"access_token": create_token(session["user_id"]), "token_type": "bearer", "expires_in": 43200}
    conn.commit()
    return result


@router.post("/logout")
def logout(request: Request, response: Response, conn=Depends(get_conn)):
    require_same_origin(request)
    token = request.cookies.get(COOKIE)
    if token:
        with conn.cursor() as cur:
            cur.execute("UPDATE device_sessions SET revoked_at=now() WHERE refresh_token_hash=%s",
                        (digest(token),))
        conn.commit()
    response.delete_cookie(COOKIE, path="/api/v1/account", secure=True, httponly=True, samesite="strict")
    return {"message": "Sesión cerrada."}


@router.post("/forgot")
def forgot(data: EmailOnly, conn=Depends(get_conn)):
    with conn.cursor() as cur:
        user = user_by_email(cur, data.email)
        if user:
            issue_code(cur, user["id"], str(data.email), "reset")
    conn.commit()
    return {"message": "Si existe la cuenta, recibirás un código de recuperación."}


@router.post("/reset")
def reset(data: Reset, conn=Depends(get_conn)):
    if data.password != data.repeat_password:
        raise HTTPException(422, "Las contraseñas no coinciden.")
    with conn.cursor() as cur:
        user = user_by_email(cur, data.email)
        if not user:
            raise HTTPException(400, "Código incorrecto o caducado.")
        good = validate_code(cur, user["id"], "reset", data.code)
        if good:
            cur.execute("UPDATE app_users SET password_hash=%s WHERE id=%s",
                        (hash_password(data.password), user["id"]))
            cur.execute("UPDATE device_sessions SET revoked_at=now() WHERE user_id=%s AND revoked_at IS NULL",
                        (user["id"],))
    conn.commit()
    if not good:
        raise HTTPException(400, "Código incorrecto o caducado.")
    return {"message": "Contraseña actualizada. Inicia sesión de nuevo."}
