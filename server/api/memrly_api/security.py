"""Argon2id password hashes and signed short-lived bearer JWTs."""
from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt
from argon2 import PasswordHasher, exceptions
from .config import settings

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
_dummy = _hasher.hash("unusable-fake-password-to-avoid-timing-leaks")

def hash_password(password: str) -> str:
    return _hasher.hash(password)

def verify_password(password: str, stored_hash: str | None) -> bool:
    try:
        return _hasher.verify(stored_hash or _dummy, password)
    except (exceptions.VerifyMismatchError, exceptions.VerificationError, exceptions.InvalidHashError):
        return False

def create_token(user_id: UUID) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        "sub": str(user_id), "aud": "memrly", "iss": "memrly-api",
        "iat": now, "exp": now + timedelta(hours=12),
    }, settings()["jwt"], algorithm="HS256")

def decode_token(token: str) -> UUID:
    data = jwt.decode(token, settings()["jwt"], algorithms=["HS256"], audience="memrly",
                      issuer="memrly-api", options={"require": ["sub", "iat", "exp"]})
    return UUID(data["sub"])
