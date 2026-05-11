import logging

from fastapi import APIRouter

from app.config import OLLAMA_BASE_URL

logger = logging.getLogger("rag.api")

router = APIRouter(tags=["models"])


@router.get("/models")
def list_models():
    """List locally available Ollama chat models."""
    try:
        import ollama

        client = ollama.Client(host=OLLAMA_BASE_URL)
        raw = client.list()
        models = raw.get("models", []) if isinstance(raw, dict) else []
        names = []
        for m in models:
            n = m.get("name") if isinstance(m, dict) else None
            if n:
                names.append(n.split(":", 1)[0])
        out = list(dict.fromkeys(names))
        return {"models": out}
    except Exception as e:
        logger.warning("list_models failed: %s", e)
        return {"models": []}
