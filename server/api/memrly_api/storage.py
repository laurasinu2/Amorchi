"""Image signature validation and safe, bounded disk writes."""
import hashlib
import os
import tempfile
from pathlib import Path
from uuid import UUID
from fastapi import HTTPException, UploadFile

SUPPORTED = {
    "image/jpeg": (".jpg", lambda b: b.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda b: b.startswith(b"RIFF") and b[8:12] == b"WEBP"),
    "image/heic": (".heic", lambda b: len(b) >= 12 and b[4:8] == b"ftyp"
                   and b[8:12] in (b"heic", b"heix", b"hevc", b"hevx", b"mif1")),
    "image/heif": (".heif", lambda b: len(b) >= 12 and b[4:8] == b"ftyp"
                   and b[8:12] in (b"mif1", b"msf1", b"heic", b"heix")),
    "image/avif": (".avif", lambda b: len(b) >= 12 and b[4:8] == b"ftyp"
                   and b[8:12] in (b"avif", b"avis")),
}

def image_extension(mime: str, header: bytes) -> str:
    rule = SUPPORTED.get(mime)
    if not rule or not rule[1](header):
        raise HTTPException(415, detail="Solo se admiten imágenes JPEG, PNG, WebP, HEIC, HEIF o AVIF válidas.")
    return rule[0]

def safe_name(filename: str | None) -> str:
    name = (filename or "fotografia").replace("\\", "/").rsplit("/", 1)[-1]
    return "".join(c for c in name if c.isprintable() and c not in "\r\n")[:200] or "fotografia"

def object_path(root: Path, key: str) -> Path:
    root = root.resolve()
    path = (root / key).resolve()
    if path == root or not path.is_relative_to(root):
        raise ValueError("Unsafe storage key")
    return path

def receive_file(file: UploadFile, root: Path, limit: int) -> tuple[Path, int, str, str]:
    folder = root / "tmp"
    folder.mkdir(parents=True, exist_ok=True)
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=folder, prefix="upload-", delete=False) as stream:
            path = Path(stream.name)
            digest = hashlib.sha256()
            total, header = 0, b""
            while chunk := file.file.read(1024 * 1024):
                total += len(chunk)
                if total > limit:
                    raise HTTPException(413, detail="El archivo supera el límite permitido.")
                if len(header) < 32:
                    header += chunk[:32 - len(header)]
                stream.write(chunk)
                digest.update(chunk)
        if not total:
            raise HTTPException(400, detail="El archivo está vacío.")
        extension = image_extension(file.content_type or "", header)
        os.chmod(path, 0o600)
        return path, total, digest.hexdigest(), extension
    except Exception:
        if path:
            path.unlink(missing_ok=True)
        raise

def object_key(file_id: UUID, extension: str) -> str:
    return f"originals/{file_id.hex[:2]}/{file_id.hex}{extension}"
