"""Memrly REST v1. Photo reads are album-scoped; no anonymous file URLs."""
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

import jwt
import psycopg
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator

from .config import settings
from .database import get_conn
from .security import create_token, decode_token, hash_password, verify_password, session_id_from_token
from .storage import object_key, object_path, receive_file, safe_name
from .accounts import router as account_router

app = FastAPI(title="Memrly REST API", version="0.1.0",
              docs_url=None, redoc_url=None, openapi_url=None)
bearer = HTTPBearer(auto_error=False)
app.include_router(account_router)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)

    @field_validator("display_name")
    @classmethod
    def normalize_name(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("El nombre no puede estar vacío.")
        return value


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 43200


class PhotoOut(BaseModel):
    id: UUID
    filename: str
    name: str
    uploaded_at: datetime
    captured_local_date: date
    latitude: float | None
    longitude: float | None
    mime_type: str
    size_bytes: int


def current_user(
    credential: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    conn=Depends(get_conn),
) -> UUID:
    if not credential:
        raise HTTPException(401, "Inicia sesión para acceder a las fotografías.",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        uid = decode_token(credential.credentials)
        sid = session_id_from_token(credential.credentials)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Sesión inválida o caducada.")
    with conn.cursor() as cur:
        cur.execute("""SELECT u.id FROM app_users u JOIN device_sessions d ON d.user_id=u.id
                       WHERE u.id=%s AND d.id=%s AND u.disabled_at IS NULL
                       AND d.revoked_at IS NULL
                       AND d.expires_at>now()""", (uid, sid))
        if not cur.fetchone():
            raise HTTPException(401, "Usuario no disponible.")
    return uid


def writable_album(conn, uid: UUID) -> UUID:
    with conn.cursor() as cur:
        cur.execute("""SELECT album_id FROM album_members
                       WHERE user_id=%s AND role IN ('owner','editor')
                       ORDER BY joined_at, album_id LIMIT 1""", (uid,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(403, "No tienes permiso de subida en ningún álbum.")
    return row["album_id"]


def get_photo_row(cur, uid: UUID, photo_id: UUID):
    cur.execute(
        """SELECT m.id, f.filename, m.title AS name, m.created_at AS uploaded_at, m.captured_local_date,
                  m.latitude, m.longitude, f.mime_type, f.size_bytes, f.object_key
           FROM media m
           JOIN original_files f ON f.id=m.original_file_id AND f.album_id=m.album_id
           JOIN album_members am ON am.album_id=m.album_id
           WHERE m.id=%s AND am.user_id=%s AND m.deleted_at IS NULL""",
        (photo_id, uid),
    )
    return cur.fetchone()


@app.get("/api/v1/health")
def health():
    return {"service": "memrly", "status": "ok"}


# Legacy endpoints deliberately disabled: they bypassed email verification and revocable sessions.
@app.post("/api/v1/auth/register", status_code=410)
def legacy_register():
    raise HTTPException(410, "Utiliza /api/v1/account/register.")

@app.post("/api/v1/auth/login", status_code=410)
def legacy_login():
    raise HTTPException(410, "Utiliza /api/v1/account/login.")


@app.get("/api/v1/auth/me")
def me(uid: Annotated[UUID, Depends(current_user)], conn=Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute("""SELECT id,email,display_name,created_at,email_verified_at FROM app_users
                       WHERE id=%s AND disabled_at IS NULL""", (uid,))
        return cur.fetchone()


@app.get("/api/v1/photos", response_model=list[PhotoOut])
def list_photos(uid: Annotated[UUID, Depends(current_user)], conn=Depends(get_conn),
                limit: int = 100, offset: int = 0):
    if not 1 <= limit <= 200 or not 0 <= offset <= 100000:
        raise HTTPException(422, "Paginación inválida.")
    with conn.cursor() as cur:
        cur.execute(
            """SELECT m.id, f.filename, m.title AS name, m.created_at AS uploaded_at,
                      m.captured_local_date, m.latitude, m.longitude,
                      f.mime_type, f.size_bytes
               FROM media m
               JOIN original_files f ON f.id=m.original_file_id AND f.album_id=m.album_id
               JOIN album_members am ON am.album_id=m.album_id
               WHERE am.user_id=%s AND m.deleted_at IS NULL
               ORDER BY m.created_at DESC, m.id DESC
               LIMIT %s OFFSET %s""",
            (uid,limit,offset),
        )
        return cur.fetchall()


@app.get("/api/v1/photos/{photo_id}", response_model=PhotoOut)
def photo_details(photo_id: UUID, uid: Annotated[UUID, Depends(current_user)],
                  conn=Depends(get_conn)):
    with conn.cursor() as cur:
        row = get_photo_row(cur,uid,photo_id)
    if row is None:
        raise HTTPException(404, "Fotografía no encontrada.")
    return row


@app.get("/api/v1/photos/{photo_id}/file")
def download_photo(photo_id: UUID, uid: Annotated[UUID, Depends(current_user)],
                   conn=Depends(get_conn)):
    with conn.cursor() as cur:
        row = get_photo_row(cur,uid,photo_id)
    if row is None:
        raise HTTPException(404, "Fotografía no encontrada.")
    try:
        path = object_path(settings()["storage"],row["object_key"])
    except ValueError:
        raise HTTPException(500, "La ruta de almacenamiento es incorrecta.")
    if not path.is_file():
        raise HTTPException(404, "Falta el archivo original.")
    return FileResponse(path,media_type=row["mime_type"],filename=row["filename"],
                        headers={"Cache-Control":"private, no-store",
                                 "X-Content-Type-Options":"nosniff"})


@app.post("/api/v1/photos", response_model=PhotoOut, status_code=201)
def upload_photo(
    uid: Annotated[UUID, Depends(current_user)],
    conn=Depends(get_conn),
    file: UploadFile = File(...),
    name: str | None = Form(None, max_length=180),
    latitude: float | None = Form(None, ge=-90, le=90),
    longitude: float | None = Form(None, ge=-180, le=180),
    captured_local_date: date | None = Form(None),
):
    if (latitude is None) != (longitude is None):
        raise HTTPException(422, "Indica latitud y longitud juntas.")
    cfg = settings()
    album_id = writable_album(conn,uid)
    temp, length, sha256, extension = receive_file(file,cfg["storage"],cfg["max_bytes"])
    original_id, photo_id = uuid4(),uuid4()
    key = object_key(original_id,extension)
    display_name = (name or Path(safe_name(file.filename)).stem).strip()[:180] or "Fotografía"
    final_path = object_path(cfg["storage"],key)
    moved = False
    committed = False
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO original_files
                   (id,album_id,object_key,filename,mime_type,size_bytes,sha256)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (original_id,album_id,key,safe_name(file.filename),file.content_type,length,sha256),
            )
            cur.execute(
                """INSERT INTO media
                   (id,album_id,original_file_id,title,captured_local_date,date_source,
                    latitude,longitude,uploaded_by)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (photo_id,album_id,original_id,display_name,
                 captured_local_date or datetime.now(timezone.utc).date(),
                 "manual" if captured_local_date else "file",
                 latitude,longitude,uid),
            )
            final_path.parent.mkdir(parents=True,exist_ok=True)
            # Unique UUID path; never overwrite an existing original.
            with final_path.open("xb") as target, temp.open("rb") as source:
                import shutil
                shutil.copyfileobj(source,target,1024*1024)
            moved = True
            row = get_photo_row(cur,uid,photo_id)
        conn.commit()
        committed = True
        return row
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(409, "Esta fotografía ya existe en tu álbum.")
    except Exception:
        conn.rollback()
        raise
    finally:
        temp.unlink(missing_ok=True)
        # The file is removed only if this request failed to commit.
        # An already committed upload never loses its original.
        if moved and not committed:
            final_path.unlink(missing_ok=True)
