from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_ready_success(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("app.routers.health.VECTOR_STORE_PATH", tmp_path)
    mock_client = MagicMock()
    mock_client.list.return_value = {"models": []}
    with patch("app.routers.health.ollama.Client", return_value=mock_client):
        r = client.get("/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["vector_store"] == "ok"
    assert body["checks"]["ollama"] == "ok"


def test_health_ready_503_when_ollama_down(tmp_path: Path, monkeypatch):
    monkeypatch.setattr("app.routers.health.VECTOR_STORE_PATH", tmp_path)

    def boom():
        raise ConnectionError("no daemon")

    mock_client = MagicMock()
    mock_client.list.side_effect = boom
    with patch("app.routers.health.ollama.Client", return_value=mock_client):
        r = client.get("/health/ready")
    assert r.status_code == 503
    assert r.json()["status"] == "not_ready"
    assert "ollama" in r.json()["checks"]
