import logging
import time

import ollama
from app.config import EMBEDDING_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger("rag.embedding")


def embed(text: str, model: str | None = None) -> list[float]:
    """Embed a single string. Returns a list of floats."""
    model_name = model or EMBEDDING_MODEL
    t0 = time.perf_counter()
    client = ollama.Client(host=OLLAMA_BASE_URL)
    try:
        out = client.embeddings(model=model_name, prompt=text)
        return out["embedding"]
    finally:
        ms = (time.perf_counter() - t0) * 1000
        logger.debug(
            "embed model=%s ms=%.1f prompt_chars=%d",
            model_name,
            ms,
            len(text or ""),
        )


def embed_batch(texts: list[str], model: str | None = None) -> list[list[float]]:
    """Embed multiple strings. Returns a list of embedding vectors."""
    return [embed(t, model=model) for t in texts]