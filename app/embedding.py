import logging
import time

import ollama
from app.config import EMBEDDING_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger("rag.embedding")


def embed(text: str, model: str | None = None, *, log_timing: bool = True) -> list[float]:
    """Embed a single string. Returns a list of floats."""
    model_name = model or EMBEDDING_MODEL
    t0 = time.perf_counter()
    client = ollama.Client(host=OLLAMA_BASE_URL)
    try:
        out = client.embeddings(model=model_name, prompt=text)
        return out["embedding"]
    finally:
        if log_timing:
            ms = (time.perf_counter() - t0) * 1000
            logger.debug(
                "embed model=%s ms=%.1f prompt_chars=%d",
                model_name,
                ms,
                len(text or ""),
            )


def embed_batch(texts: list[str], model: str | None = None) -> list[list[float]]:
    """Embed multiple strings. Returns a list of embedding vectors."""
    if not texts:
        return []
    model_name = model or EMBEDDING_MODEL
    t0 = time.perf_counter()
    out = [embed(t, model=model_name, log_timing=False) for t in texts]
    ms = (time.perf_counter() - t0) * 1000
    logger.debug(
        "embed_batch chunks=%d model=%s embed_total_ms=%.1f",
        len(texts),
        model_name,
        ms,
    )
    return out