"""Authenticated, idempotent photo transfer between IndexedDB and private Memrly storage."""
import io
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import psycopg
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from .config import settings
from .database import get_conn
from .storage import receive_file, object_key, object_path, safe_name

router = APIRouter(prefix="/api/v1/sync", tags=["photo-sync"])

class MetadataPayload(BaseModel):
    metadata: dict = Field(default_factory=dict)

ALLOWED_FIELDS = {
    "id","filename","mimeType","size","hash","takenOn","takenTime","dateSource",
    "place","latitude","longitude","memoryIds","subjectIds","description",
    "favorite","createdAt","celebrationIncludeIds","celebrationExcludeIds"
}

def clean_metadata(raw: str | dict, photo_id: UUID) -> dict:
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError):
        raise HTTPException(422, "Metadatos JSON incorrectos.")
    if not isinstance(data, dict):
        raise HTTPException(422, "Los metadatos deben ser un objeto.")
    filtered = {key:value for key,value in data.items() if key in ALLOWED_FIELDS}
    filtered["id"] = str(photo_id)
    encoded = json.dumps(filtered, ensure_ascii=False)
    if len(encoded.encode("utf-8")) > 32768:
        raise HTTPException(413, "Metadatos demasiado grandes.")
    return filtered

def first_writable_album(cur, uid: UUID) -> UUID:
    cur.execute("""SELECT album_id FROM album_members WHERE user_id=%s
                   AND role IN ('owner','editor')
                   ORDER BY joined_at, album_id LIMIT 1""", (uid,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(403, "No tienes permisos de escritura en un álbum.")
    return row["album_id"]

def photo_for_client(cur, uid: UUID, photo_id: UUID):
    cur.execute("""SELECT m.id,m.client_photo_id,m.client_metadata,m.album_id,
                          f.filename,f.mime_type,f.size_bytes,f.object_key,f.sha256
                   FROM media m
                   JOIN original_files f ON f.id=m.original_file_id AND f.album_id=m.album_id
                   JOIN album_members am ON am.album_id=m.album_id
                   WHERE am.user_id=%s AND m.client_photo_id=%s AND m.deleted_at IS NULL""",
                (uid,photo_id))
    return cur.fetchone()

def photo_result(row):
    return {"id":str(row["client_photo_id"]), "metadata":row["client_metadata"],
            "filename":row["filename"],"size":row["size_bytes"],"sha256":row["sha256"]}

# Imported here only after main.current_user has been defined; see main.py's bottom include.
from .main import current_user

@router.get("/photos")
def list_synced_photos(uid: UUID = Depends(current_user), conn=Depends(get_conn),
                       limit: int = 100, offset: int = 0):
    if limit < 1 or limit > 200 or offset < 0 or offset > 1000000:
        raise HTTPException(422, "Paginación inválida.")
    with conn.cursor() as cur:
        cur.execute("""SELECT m.client_photo_id,m.client_metadata,f.filename,f.size_bytes,f.sha256
                       FROM media m
                       JOIN original_files f ON f.id=m.original_file_id AND f.album_id=m.album_id
                       JOIN album_members am ON am.album_id=m.album_id
                       WHERE am.user_id=%s AND m.client_photo_id IS NOT NULL AND m.deleted_at IS NULL
                       ORDER BY m.created_at,m.id LIMIT %s OFFSET %s""",(uid,limit,offset))
        return [photo_result(row) for row in cur.fetchall()]

@router.get("/photos/{photo_id}/file")
def get_synced_original(photo_id:UUID, uid:UUID=Depends(current_user), conn=Depends(get_conn)):
    with conn.cursor() as cur:
        row=photo_for_client(cur,uid,photo_id)
    if not row:
        raise HTTPException(404, "Fotografía no encontrada.")
    try:
        path=object_path(settings()["storage"],row["object_key"])
    except ValueError:
        raise HTTPException(500,"Ruta de almacenamiento inválida.")
    if not path.is_file():
        raise HTTPException(404,"Archivo original no disponible.")
    return FileResponse(path,media_type=row["mime_type"],filename=row["filename"],
                        headers={"Cache-Control":"private, no-store",
                                 "X-Content-Type-Options":"nosniff"})

@router.get("/photos/{photo_id}/preview")
def preview_photo(photo_id:UUID, size:int=360, uid:UUID=Depends(current_user), conn=Depends(get_conn)):
    """Resize only the transmitted image in RAM. Never alter/delete the full-resolution original."""
    if size not in (360,1280):
        raise HTTPException(422,"Tamaño de vista previa no permitido.")
    with conn.cursor() as cur:
        row=photo_for_client(cur,uid,photo_id)
    if not row:
        raise HTTPException(404,"Fotografía no encontrada.")
    path=object_path(settings()["storage"],row["object_key"])
    if not path.is_file():
        raise HTTPException(404,"Archivo original no encontrado.")
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
        with Image.open(path) as im:
            im=ImageOps.exif_transpose(im)
            im.thumbnail((size,size),Image.Resampling.LANCZOS)
            if im.mode not in ("RGB","RGBA"):
                im=im.convert("RGB")
            output=io.BytesIO()
            im.save(output,format="WEBP",quality=78,method=4)
            return Response(output.getvalue(),media_type="image/webp",
                            headers={"Cache-Control":"private, no-store",
                                     "X-Content-Type-Options":"nosniff"})
    except (UnidentifiedImageError,OSError,ValueError):
        # HEIC may not be decoded by Pillow; the original is still safely served privately.
        return FileResponse(path,media_type=row["mime_type"],filename=row["filename"],
                            headers={"Cache-Control":"private, no-store"})

@router.post("/photos",status_code=201)
def upload_synced_photo(
    photo_id: UUID=Form(...),
    metadata: str=Form(...),
    file: UploadFile=File(...),
    uid: UUID=Depends(current_user), conn=Depends(get_conn)
):
    info=clean_metadata(metadata,photo_id)
    cfg=settings()
    with conn.cursor() as cur:
        album=first_writable_album(cur,uid)
        previous=photo_for_client(cur,uid,photo_id)
        if previous:
            return photo_result(previous)
    # Keep a bounded temp copy; re-check idempotence in transaction.
    temp,length,digest,extension=receive_file(file,cfg["storage"],cfg["max_bytes"])
    original_id,media_id=uuid4(),uuid4()
    key=object_key(original_id,extension)
    final=object_path(cfg["storage"],key)
    moved=False
    committed=False
    try:
        with conn.cursor() as cur:
            # Serialize concurrent attempts for a specific photo via album advisory lock.
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                        (str(album)+":"+str(photo_id),))
            existing=photo_for_client(cur,uid,photo_id)
            if existing:
                if existing["sha256"] and existing["sha256"] != digest:
                    raise HTTPException(409,"Identificador de fotografía ya utilizado con otro archivo.")
                # Existing UUID was uploaded concurrently. No new original is stored.
                return photo_result(existing)
            cur.execute("""SELECT m.client_photo_id,m.client_metadata,f.filename,f.size_bytes,f.sha256
                           FROM original_files f JOIN media m
                           ON m.original_file_id=f.id AND m.album_id=f.album_id
                           WHERE f.album_id=%s AND f.sha256=%s AND m.deleted_at IS NULL
                           LIMIT 1""",(album,digest))
            duplicate=cur.fetchone()
            if duplicate:
                raise HTTPException(409,"Este original ya existe en el álbum con otro identificador.")
            filename=safe_name(file.filename)
            cur.execute("""INSERT INTO original_files(id,album_id,object_key,filename,mime_type,size_bytes,sha256)
                           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                        (original_id,album,key,filename,file.content_type,length,digest))
            taken=info.get("takenOn")
            if not isinstance(taken,str) or len(taken)!=10:
                taken=datetime.now(timezone.utc).date().isoformat()
            origin=info.get("dateSource") if info.get("dateSource") in ("exif","file","manual") else "file"
            latitude=info.get("latitude") if isinstance(info.get("latitude"),(int,float)) else None
            longitude=info.get("longitude") if isinstance(info.get("longitude"),(int,float)) else None
            if latitude is None or longitude is None or not(-90<=latitude<=90 and -180<=longitude<=180):
                latitude=longitude=None
            cur.execute("""INSERT INTO media
                        (id,album_id,original_file_id,title,captured_local_date,date_source,
                         latitude,longitude,uploaded_by,client_photo_id,client_metadata)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
                        (media_id,album,original_id,Path(filename).stem[:180],taken,origin,
                         latitude,longitude,uid,photo_id,json.dumps(info,ensure_ascii=False)))
            final.parent.mkdir(parents=True,exist_ok=True)
            with final.open("xb") as dest, temp.open("rb") as source:
                shutil.copyfileobj(source,dest,1024*1024)
            moved=True
            cur.execute("""SELECT m.client_photo_id,m.client_metadata,f.filename,f.size_bytes,f.sha256
                           FROM media m JOIN original_files f
                           ON f.id=m.original_file_id AND f.album_id=m.album_id
                           WHERE m.id=%s""",(media_id,))
            result=photo_result(cur.fetchone())
        conn.commit()
        committed=True
        return result
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(409,"El original ya existe en el álbum.")
    except Exception:
        conn.rollback()
        raise
    finally:
        temp.unlink(missing_ok=True)
        if moved and not committed:
            final.unlink(missing_ok=True)

@router.put("/photos/{photo_id}/metadata")
def update_synced_metadata(photo_id:UUID,payload:MetadataPayload,
                           uid:UUID=Depends(current_user),conn=Depends(get_conn)):
    info=clean_metadata(payload.metadata,photo_id)
    with conn.cursor() as cur:
        row=photo_for_client(cur,uid,photo_id)
        if not row:
            raise HTTPException(404,"Fotografía no encontrada.")
        writable=first_writable_album(cur,uid)
        if row["album_id"]!=writable:
            raise HTTPException(403,"No tienes permisos de edición en este álbum.")
        taken=info.get("takenOn")
        if not isinstance(taken,str) or len(taken)!=10:
            raise HTTPException(422,"Fecha incorrecta.")
        origin=info.get("dateSource") if info.get("dateSource") in ("exif","file","manual") else "file"
        latitude=info.get("latitude") if isinstance(info.get("latitude"),(int,float)) else None
        longitude=info.get("longitude") if isinstance(info.get("longitude"),(int,float)) else None
        if latitude is None or longitude is None or not(-90<=latitude<=90 and -180<=longitude<=180):
            latitude=longitude=None
        cur.execute("""UPDATE media SET client_metadata=%s::jsonb,captured_local_date=%s,date_source=%s,
                       latitude=%s,longitude=%s,updated_at=now(),version=version+1
                       WHERE id=%s""",
                    (json.dumps(info,ensure_ascii=False),taken,origin,latitude,longitude,row["id"]))
    conn.commit()
    return {"id":str(photo_id),"updated":True}

@router.delete("/photos/{photo_id}")
def remove_online_photo(photo_id:UUID,uid:UUID=Depends(current_user),conn=Depends(get_conn)):
    """A confirmed deletion removes the original from the private album.
    File cleanup follows the database transaction; a cleanup failure is logged
    and can be repaired from an orphan-file audit."""
    with conn.cursor() as cur:
        album=first_writable_album(cur,uid)
        row=photo_for_client(cur,uid,photo_id)
        if not row:
            return {"deleted":True}
        if row["album_id"]!=album:
            raise HTTPException(403,"No tienes permiso para eliminar esta fotografía.")
        cur.execute("SELECT original_file_id FROM media WHERE id=%s AND album_id=%s",
                    (row["id"],album))
        media=cur.fetchone()
        cur.execute("DELETE FROM media WHERE id=%s AND album_id=%s",(row["id"],album))
        cur.execute("DELETE FROM original_files WHERE id=%s AND album_id=%s",
                    (media["original_file_id"],album))
    conn.commit()
    path=object_path(settings()["storage"],row["object_key"])
    try:
        path.unlink(missing_ok=True)
    except OSError:
        import logging
        logging.getLogger(__name__).exception("Orphan file requires server cleanup: %s",photo_id)
    return {"deleted":True}
