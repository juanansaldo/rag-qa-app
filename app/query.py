import logging
import time

from app.config import TOP_K
from app.llm import generate
from app.logging_setup import preview_text
from app.store import search

logger = logging.getLogger("rag.query")

SYSTEM_PROMPT = """Answer only using the context below. If the answer is not in the context, say
    "I don't see that in the documents." Do not make up information."""


def rag_query(
    question: str,
    session_id: str = "default",
    top_k: int | None = None,
    model: str | None = None,
    embedding_model: str | None = None,
) -> dict:
    """Run RAG: retrieve chunks, then generate answer. Returns {"answer": str, "sources": list}."""
    k = top_k if top_k is not None else TOP_K
    t0 = time.perf_counter()
    hits = search(question, top_k=k, session_id=session_id, embedding_model=embedding_model)
    retrieve_ms = (time.perf_counter() - t0) * 1000
    if not hits:
        logger.info(
            "rag_query session=%s top_k=%s embedding_model=%s retrieve_ms=%.1f hits=0 question=%r",
            session_id,
            k,
            embedding_model,
            retrieve_ms,
            preview_text(question, 160),
        )
        return {"answer": "No relevant documents found. Ingest some documents first.", "sources": []}
    context = "\n\n---\n\n".join(h["document"] for h in hits)
    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"
    answer = generate(SYSTEM_PROMPT, user_prompt, model=model)
    total_ms = (time.perf_counter() - t0) * 1000
    generate_ms = total_ms - retrieve_ms
    logger.info(
        "rag_query session=%s top_k=%s model=%s embedding_model=%s hits=%d retrieve_ms=%.1f generate_ms=%.1f total_ms=%.1f question=%r",
        session_id,
        k,
        model,
        embedding_model,
        len(hits),
        retrieve_ms,
        generate_ms,
        total_ms,
        preview_text(question, 160),
    )
    sources = [{"document": h["document"][:200], "metadata": h["metadata"]} for h in hits]
    return {"answer": answer, "sources": sources}