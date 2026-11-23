"""Account-scoped server-side Memrly records: memories, people, collections, settings."""
import json
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .database import get_conn
from .main import current_user

router=APIRouter(prefix="/api/v1/library",tags=["online-library"])
KINDS={"memory","subject","collection","settings"}

class EntityBody(BaseModel):
    payload:dict

def album_for_user(cur,uid,write=False):
    cur.execute("""SELECT album_id FROM album_members WHERE user_id=%s
                    AND (%s=false OR role IN ('owner','editor'))
                    ORDER BY joined_at,album_id LIMIT 1""",(uid,write))
    item=cur.fetchone()
    if not item:raise HTTPException(403,"No hay álbum autorizado.")
    return item["album_id"]

def validate(kind,key,payload=None):
    if kind not in KINDS or not 1<=len(key)<=96 or (kind=="settings" and key!="main"):
        raise HTTPException(422,"Tipo o identificador incorrecto.")
    if payload is not None:
        if payload.get("id")!=key:
            raise HTTPException(422,"El identificador del registro no coincide.")
        if len(json.dumps(payload,ensure_ascii=False).encode())>65536:
            raise HTTPException(413,"Registro demasiado grande.")

@router.get("/entities")
def list_entities(uid:UUID=Depends(current_user),conn=Depends(get_conn)):
    with conn.cursor() as cur:
        album=album_for_user(cur,uid)
        cur.execute("""SELECT kind,client_id,payload FROM client_entities
                       WHERE album_id=%s AND deleted_at IS NULL
                       ORDER BY kind,client_id""",(album,))
        result={"memory":[],"subject":[],"collection":[],"settings":[]}
        for row in cur.fetchall():
            result[row["kind"]].append(row["payload"])
        return result

@router.put("/entities/{kind}/{key}")
def put_entity(kind:str,key:str,data:EntityBody,uid:UUID=Depends(current_user),conn=Depends(get_conn)):
    validate(kind,key,data.payload)
    with conn.cursor() as cur:
        album=album_for_user(cur,uid,True)
        cur.execute("""INSERT INTO client_entities(album_id,kind,client_id,payload)
                       VALUES (%s,%s,%s,%s::jsonb)
                       ON CONFLICT(album_id,kind,client_id) DO UPDATE
                       SET payload=EXCLUDED.payload,updated_at=now(),deleted_at=NULL""",
                    (album,kind,key,json.dumps(data.payload,ensure_ascii=False)))
    conn.commit()
    return {"saved":True}

@router.delete("/entities/{kind}/{key}")
def delete_entity(kind:str,key:str,uid:UUID=Depends(current_user),conn=Depends(get_conn)):
    validate(kind,key)
    if kind=="settings":raise HTTPException(403,"La configuración no puede eliminarse.")
    with conn.cursor() as cur:
        album=album_for_user(cur,uid,True)
        cur.execute("""UPDATE client_entities SET deleted_at=now(),updated_at=now()
                       WHERE album_id=%s AND kind=%s AND client_id=%s""",(album,kind,key))
    conn.commit()
    return {"deleted":True}
