import logging
from pathlib import Path

import ollama
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import OLLAMA_BASE_URL, VECTOR_STORE_PATH

logger = logging.getLogger("rag.health")

router = APIRouter(tags=["health"])


def _vector_store_writable() -> tuple[bool, str]:
    try:
        root = Path(VECTOR_STORE_PATH)
        root.mkdir(parents=True, exist_ok=True)
        probe = root / ".write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True, "ok"
    except Exception as e:
        logger.warning("readiness vector_store check failed: %s", e)
        return False, str(e)


def _ollama_reachable() -> tuple[bool, str]:
    try:
        client = ollama.Client(host=OLLAMA_BASE_URL)
        client.list()
        return True, "ok"
    except Exception as e:
        logger.warning("readiness ollama check failed: %s", e)
        return False, str(e)


@router.get("/health")
def health():
    """Liveness: process is up (use for load balancer pings)."""
    return {"status": "ok"}


@router.get("/health/ready")
def health_ready():
    """Readiness: vector store path writable and Ollama API reachable."""
    ok_disk, disk_detail = _vector_store_writable()
    ok_ollama, ollama_detail = _ollama_reachable()
    ok = ok_disk and ok_ollama
    payload = {
        "status": "ready" if ok else "not_ready",
        "checks": {
            "vector_store": disk_detail,
            "ollama": ollama_detail,
        },
    }
    return JSONResponse(payload, status_code=200 if ok else 503)
