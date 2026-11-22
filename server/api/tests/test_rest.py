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
        result = client.post("/api/v1/auth/register", json={
            "email": "not-registered@gmail.com", "password": "strong-password-123",
            "display_name": "Usuario",
        })
    assert result.status_code == 403
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "true")
    settings.cache_clear()

def test_private_upload_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("MEMRLY_STORAGE_ROOT", str(tmp_path))
    monkeypatch.setenv("MEMRLY_ALLOW_SIGNUP", "true")
    settings.cache_clear()
    suffix = uuid4().hex[:12]
    with TestClient(app) as client:
        def register(alias):
            email = f"{alias}-{suffix}@gmail.com"
            response = client.post("/api/v1/auth/register", json={
                "email": email, "password": "a-long-private-password-123",
                "display_name": alias,
            })
            assert response.status_code == 201, response.text
            return email, response.json()["access_token"]
        email_a, token_a = register("one")
        email_b, token_b = register("two")
        h1 = {"Authorization": "Bearer " + token_a}
        h2 = {"Authorization": "Bearer " + token_b}
        assert client.get("/api/v1/photos").status_code == 401
        assert client.get("/api/v1/photos", headers=h2).json() == []
        assert client.get("/api/v1/auth/me", headers=h1).json()["email"] == email_a
        assert client.post("/api/v1/auth/login", json={
            "email": email_a,"password":"a-long-private-password-123",
        }).status_code == 200
        assert client.post("/api/v1/auth/login", json={
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
    settings.cache_clear()
