"""Real PostgreSQL integration: photos stay private to each account."""
import os
from uuid import uuid4
from fastapi.testclient import TestClient
from memrly_api.config import settings
from memrly_api.main import app

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 70

def test_health_is_public():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200 and response.json()["service"] == "memrly"

def test_signup_requires_explicit_enable(monkeypatch):
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "false")
    settings.cache_clear()
    with TestClient(app) as client:
        result = client.post("/api/v1/account/register", json={
            "email": "not-registered@gmail.com", "password": "strong-password-123",
            "repeat_password": "strong-password-123",
            "display_name": "Usuario",
        })
    assert result.status_code == 403
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "true")
    settings.cache_clear()

def test_private_upload_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("MEMRLY_STORAGE_ROOT", str(tmp_path))
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "true")
    monkeypatch.delenv("MEMRLY_SMTP_HOST", raising=False)
    settings.cache_clear()
    suffix = uuid4().hex[:12]
    codes = {}
    monkeypatch.setattr("memrly_api.accounts.send_code", lambda email, code, purpose: codes.__setitem__((email, purpose), code))
    with TestClient(app) as client:
        def register(alias):
            email = f"{alias}-{suffix}@gmail.com"
            response = client.post("/api/v1/account/register", json={
                "email": email, "password": "a-long-private-password-123",
                "repeat_password": "a-long-private-password-123",
                "display_name": alias,
            })
            assert response.status_code == 201, response.text
            # Without SMTP, registration succeeds and email remains unverified.
            login = client.post("/api/v1/account/login", json={
                "email": email, "password": "a-long-private-password-123",
                "remember": True,
            })
            assert login.status_code == 200, login.text
            profile = client.get("/api/v1/auth/me", headers={
                "Authorization": "Bearer " + login.json()["access_token"]
            })
            assert profile.status_code == 200 and profile.json()["email_verified_at"] is None
            return email, login.json()["access_token"]
        email_a, token_a = register("one")
        email_b, token_b = register("two")
        h1 = {"Authorization": "Bearer " + token_a}
        h2 = {"Authorization": "Bearer " + token_b}
        assert client.get("/api/v1/photos").status_code == 401
        assert client.get("/api/v1/photos", headers=h2).json() == []
        assert client.get("/api/v1/auth/me", headers=h1).json()["email"] == email_a
        assert client.post("/api/v1/account/login", json={
            "email": email_a,"password":"a-long-private-password-123",
        }).status_code == 200
        assert client.post("/api/v1/account/login", json={
            "email": email_a,"password":"wrong-password",
        }).status_code == 401
        bad = client.post("/api/v1/photos", headers=h1,
            files={"file":("photo.html",b"<html>bad</html>","image/png")})
        assert bad.status_code == 415
        wrong_coords = client.post("/api/v1/photos", headers=h1,
            files={"file":("photo.png",PNG,"image/png")},
            data={"latitude":"41.4"})
        assert wrong_coords.status_code == 422
        uploaded = client.post("/api/v1/photos", headers=h1,
            files={"file":("nieve.png", PNG,"image/png")},
            data={"latitude":"41.4132","longitude":"2.1032",
                  "captured_local_date":"2026-03-06","name":"Excursión a la nieve"})
        assert uploaded.status_code == 201, uploaded.text
        photo = uploaded.json()
        assert photo["filename"] == "nieve.png"
        assert photo["name"] == "Excursión a la nieve"
        assert photo["captured_local_date"] == "2026-03-06"
        assert photo["latitude"] == 41.4132 and photo["longitude"] == 2.1032
        assert photo["uploaded_at"]
        photo_id = photo["id"]
        assert client.get("/api/v1/photos", headers=h1).json()[0]["id"] == photo_id
        assert client.get(f"/api/v1/photos/{photo_id}",headers=h2).status_code == 404
        assert client.get(f"/api/v1/photos/{photo_id}/file",headers=h2).status_code == 404
        original = client.get(f"/api/v1/photos/{photo_id}/file",headers=h1)
        assert original.status_code == 200 and original.content == PNG
        duplicate = client.post("/api/v1/photos", headers=h1,
            files={"file":("same.png", PNG,"image/png")})
        assert duplicate.status_code == 409
        assert client.get(f"/api/v1/photos/{photo_id}/file",headers=h1).content == PNG
        assert client.get("/api/v1/photos",headers=h2).json() == []
        recovery = client.post("/api/v1/account/forgot", json={"email": email_a})
        assert recovery.status_code == 200
        assert (email_a, "reset") not in codes
        # Password recovery remains unavailable until mail delivery is configured.
    settings.cache_clear()

def test_private_photo_sync_upload_restore_and_metadata(tmp_path, monkeypatch):
    import json
    monkeypatch.setenv("MEMRLY_STORAGE_ROOT", str(tmp_path))
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "true")
    monkeypatch.delenv("MEMRLY_SMTP_HOST", raising=False)
    settings.cache_clear()
    suffix=uuid4().hex[:12]
    with TestClient(app) as client:
        def token(alias):
            email=f"sync-{alias}-{suffix}@example.com"
            response=client.post("/api/v1/account/register",json={
                "email":email,"password":"a-long-private-password-123",
                "repeat_password":"a-long-private-password-123","display_name":alias
            })
            assert response.status_code==201, response.text
            login=client.post("/api/v1/account/login",json={
                "email":email,"password":"a-long-private-password-123","remember":True
            })
            assert login.status_code==200,login.text
            return login.json()["access_token"]
        auth_a={"Authorization":"Bearer "+token("a")}
        auth_b={"Authorization":"Bearer "+token("b")}
        photo_id=str(uuid4())
        original={
            "id":photo_id,"filename":"playa.png","mimeType":"image/png",
            "takenOn":"2026-07-14","dateSource":"manual","place":"Barcelona",
            "latitude":41.38,"longitude":2.17,"memoryIds":[],"subjectIds":[],
            "description":"Día de verano","favorite":False
        }
        assert client.get("/api/v1/sync/photos").status_code==401
        response=client.post("/api/v1/sync/photos",headers=auth_a,
            files={"file":("playa.png",PNG,"image/png")},
            data={"photo_id":photo_id,"metadata":json.dumps(original)})
        assert response.status_code==201,response.text
        assert response.json()["id"]==photo_id
        assert response.json()["metadata"]["place"]=="Barcelona"
        assert client.get("/api/v1/sync/photos",headers=auth_b).json()==[]
        assert client.get(f"/api/v1/sync/photos/{photo_id}/file",headers=auth_b).status_code==404
        assert client.get(f"/api/v1/sync/photos/{photo_id}/file",headers=auth_a).content==PNG
        again=client.post("/api/v1/sync/photos",headers=auth_a,
            files={"file":("playa.png",PNG,"image/png")},
            data={"photo_id":photo_id,"metadata":json.dumps(original)})
        assert again.status_code==201,again.text
        assert len(client.get("/api/v1/sync/photos",headers=auth_a).json())==1
        modified={**original,"place":"Girona","description":"Actualizado"}
        updated=client.put(f"/api/v1/sync/photos/{photo_id}/metadata",headers=auth_a,
            json={"metadata":modified})
        assert updated.status_code==200,updated.text
        records=client.get("/api/v1/sync/photos",headers=auth_a).json()
        assert records[0]["metadata"]["place"]=="Girona"
        assert client.put(f"/api/v1/sync/photos/{photo_id}/metadata",headers=auth_b,
            json={"metadata":modified}).status_code==404
    settings.cache_clear()


def test_online_private_library_and_lossless_original_storage(tmp_path,monkeypatch):
    """Metadata is server-owned; thumbnail generation never creates another stored file."""
    import io, json, hashlib
    from PIL import Image
    monkeypatch.setenv("MEMRLY_STORAGE_ROOT",str(tmp_path))
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP","true")
    monkeypatch.delenv("MEMRLY_SMTP_HOST",raising=False)
    settings.cache_clear()
    png=io.BytesIO()
    Image.new("RGB",(960,720),(40,95,145)).save(png,format="PNG")
    original=png.getvalue()
    suffix=uuid4().hex[:12]
    with TestClient(app) as client:
        def session(label):
            email=f"online-{label}-{suffix}@example.com"
            registration=client.post("/api/v1/account/register",json={
                "email":email,"password":"a-long-private-password-123",
                "repeat_password":"a-long-private-password-123","display_name":label
            })
            assert registration.status_code==201,registration.text
            result=client.post("/api/v1/account/login",json={
                "email":email,"password":"a-long-private-password-123","remember":True
            })
            assert result.status_code==200,result.text
            return {"Authorization":"Bearer "+result.json()["access_token"]}
        own=session("owner")
        other=session("other")
        image_id=str(uuid4())
        photo={"id":image_id,"filename":"viaje.png","mimeType":"image/png","size":len(original),
               "hash":hashlib.sha256(original).hexdigest(),"takenOn":"2026-11-21",
               "dateSource":"manual","place":"Barcelona","memoryIds":[],"subjectIds":[],
               "description":"","favorite":False,"createdAt":"2026-11-23T10:00:00Z"}
        assert client.get("/api/v1/library/entities",headers=other).json()["memory"]==[]
        memory_id=str(uuid4())
        memo={"id":memory_id,"kind":"trip","title":"Viaje","startDate":"2026-11-21",
              "endDate":"2026-11-23","description":"","place":"Barcelona",
              "favorite":False,"createdAt":"2026-11-23T10:00:00Z"}
        saved=client.put(f"/api/v1/library/entities/memory/{memory_id}",headers=own,
                         json={"payload":memo})
        assert saved.status_code==200,saved.text
        assert client.get("/api/v1/library/entities",headers=own).json()["memory"]==[memo]
        assert client.get("/api/v1/library/entities",headers=other).json()["memory"]==[]
        result=client.post("/api/v1/sync/photos",headers=own,
            data={"photo_id":image_id,"metadata":json.dumps(photo)},
            files={"file":("viaje.png",original,"image/png")})
        assert result.status_code==201,result.text
        assert client.get("/api/v1/sync/photos",headers=own).json()[0]["id"]==image_id
        assert client.get("/api/v1/sync/photos",headers=other).json()==[]
        assert client.get(f"/api/v1/sync/photos/{image_id}/preview",headers=other).status_code==404
        raw=client.get(f"/api/v1/sync/photos/{image_id}/file",headers=own)
        assert raw.status_code==200 and raw.content==original
        stored=list((tmp_path/"originals").rglob("*.png"))
        assert len(stored)==1 and stored[0].read_bytes()==original
        thumbnail=client.get(f"/api/v1/sync/photos/{image_id}/preview?size=360",headers=own)
        assert thumbnail.status_code==200,thumbnail.text[:200]
        assert thumbnail.headers["content-type"].startswith("image/webp")
        with Image.open(io.BytesIO(thumbnail.content)) as im:
            assert im.width<=360 and im.height<=360
        assert list((tmp_path/"originals").rglob("*.png"))==stored
        assert list(tmp_path.rglob("*.webp"))==[]
        deleted=client.delete(f"/api/v1/sync/photos/{image_id}",headers=own)
        assert deleted.status_code==200,deleted.text
        assert client.get("/api/v1/sync/photos",headers=own).json()==[]
        assert not stored[0].exists()
        assert client.delete(f"/api/v1/library/entities/memory/{memory_id}",headers=own).status_code==200
        assert client.get("/api/v1/library/entities",headers=own).json()["memory"]==[]
    settings.cache_clear()
