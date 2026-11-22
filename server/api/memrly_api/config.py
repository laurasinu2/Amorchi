"""Memrly-specific configuration. Never reads GeoCauce credentials."""
import os
from functools import lru_cache
from pathlib import Path

@lru_cache
def settings():
    key = os.environ.get("MEMRLY_JWT_SECRET", "")
    password = os.environ.get("MEMRLY_DB_PASSWORD", "")
    if len(key) < 32 or not password:
        raise RuntimeError("Configure MEMRLY_JWT_SECRET (32+ chars) and MEMRLY_DB_PASSWORD.")
    size = int(os.environ.get("MEMRLY_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    if not 1024 <= size <= 100 * 1024 * 1024:
        raise RuntimeError("Upload limit outside 1 KiB–100 MiB.")
    return {
        "jwt": key, "db_password": password,
        "db_host": os.environ.get("MEMRLY_DB_HOST", "db"),
        "db_name": os.environ.get("MEMRLY_DB_NAME", "memrly"),
        "db_user": os.environ.get("MEMRLY_DB_USER", "memrly"),
        "storage": Path(os.environ.get("MEMRLY_STORAGE_ROOT", "/data/files")).resolve(),
        "allow_signup": os.environ.get("MEMRLY_ALLOW_SIGNUP", "false").lower() == "true",
        "max_bytes": size,
    }
