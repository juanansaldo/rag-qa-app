from pathlib import Path
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_document_preview_returns_json(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "note.txt").write_text("hello preview world", encoding="utf-8")

    with patch("app.routers.documents.session_has_source", return_value=True):
        r = client.get(
            "/document/preview",
            params={"name": "note.txt"},
            headers={"X-Session-ID": "sess-1"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "note.txt"
    assert "hello preview" in body["preview"]


def test_document_file_requires_session_source(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with patch("app.routers.documents.session_has_source", return_value=False):
        r = client.get(
            "/document/file",
            params={"name": "missing.txt", "session_id": "s1"},
        )
    assert r.status_code == 404


def test_delete_document_removes_chunks_for_session():
    with patch("app.routers.documents.delete_session_source", return_value=5) as mock_delete:
        r = client.delete(
            "/document",
            params={"name": "note.txt"},
            headers={"X-Session-ID": "sess-1"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["name"] == "note.txt"
    assert body["deleted_chunks"] == 5
    mock_delete.assert_called_once_with(session_id="sess-1", source="note.txt")


def test_delete_document_requires_session_header():
    r = client.delete("/document", params={"name": "note.txt"})
    assert r.status_code == 400
