from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile
from memrly_api.storage import image_extension, object_key, object_path, receive_file, safe_name

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

def test_header_signatures():
    assert image_extension("image/png", PNG) == ".png"
    assert image_extension("image/jpeg", b"\xff\xd8\xff" + b"\x00" * 25) == ".jpg"
    with pytest.raises(HTTPException) as error:
        image_extension("image/png", b"<script>alert('x')</script>")
    assert error.value.status_code == 415

def test_safe_paths(tmp_path):
    assert safe_name("../../secrets/photo.jpg") == "photo.jpg"
    assert safe_name("..\\..\\photo.jpg") == "photo.jpg"
    assert object_path(tmp_path, object_key(uuid4(), ".png")).is_relative_to(tmp_path)
    with pytest.raises(ValueError):
        object_path(tmp_path, "../../etc/passwd")

def test_stream_upload_validates_before_persisting(tmp_path):
    upload = UploadFile(filename="test.png", file=BytesIO(PNG),
                        headers=Headers({"content-type": "image/png"}))
    temp, size, checksum, ext = receive_file(upload,tmp_path,1024)
    assert ext == ".png" and size == len(PNG) and len(checksum) == 64
    temp.unlink()
    too_large = UploadFile(filename="test.png", file=BytesIO(PNG),
                           headers=Headers({"content-type": "image/png"}))
    with pytest.raises(HTTPException) as error:
        receive_file(too_large,tmp_path,16)
    assert error.value.status_code == 413
    assert list((tmp_path / "tmp").iterdir()) == []
