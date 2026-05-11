import logging
import time

import chromadb

from app.config import VECTOR_STORE_PATH, TOP_K, EMBEDDING_MODEL
from app.embedding import embed
from app.logging_setup import session_log_tag

logger = logging.getLogger("rag.store")

# Persist under project root; Chroma creates the directory
_path = VECTOR_STORE_PATH
_path.mkdir(parents=True, exist_ok=True)

_client = chromadb.PersistentClient(path=str(_path))


def _normalize_embedding_model(model: str | None) -> str:
    return (model or EMBEDDING_MODEL).strip()


def _sanitize_model_name(model: str) -> str:
    return "".join(ch if (ch.isalnum() or ch in ("-", "_")) else "_" for ch in model)


def _collection_name_for_model(model: str | None) -> str:
    normalized = _normalize_embedding_model(model)
    # Keep backwards compatibility for existing default collection data.
    if normalized == EMBEDDING_MODEL:
        return "rag"
    return f"rag__{_sanitize_model_name(normalized)}"


def _get_collection(model: str | None = None):
    name = _collection_name_for_model(model)
    return _client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def _iter_rag_collections():
    cols = _client.list_collections()
    out = []
    for c in cols:
        name = c.name if hasattr(c, "name") else str(c)
        if name == "rag" or name.startswith("rag__"):
            out.append(_client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"}))
    if not out:
        out.append(_get_collection())
    return out


def add(
    id: str,
    text: str,
    metadata: dict | None = None,
    session_id: str = "default",
    embedding_model: str | None = None,
):
    """Store one document chunk: embed and add to Chroma"""
    collection = _get_collection(embedding_model)
    vector = embed(text, model=embedding_model)
    meta = dict(metadata or {})
    meta["session_id"] = session_id
    if not meta:
        meta = {"_": 0}
    collection.upsert(ids=[id], embeddings=[vector], documents=[text], metadatas=[meta])


def add_batch(
    ids: list[str], 
    texts: list[str], 
    metadatas: list[dict] | None = None,
    session_id: str = "default",
    embedding_model: str | None = None,
):
    """Store multiple chunks: Metadatas can be a list of dicts (one per chunk) or None."""
    collection = _get_collection(embedding_model)
    t_embed = time.perf_counter()
    vectors = [embed(t, model=embedding_model, log_timing=False) for t in texts]
    embed_ms = (time.perf_counter() - t_embed) * 1000
    model_norm = _normalize_embedding_model(embedding_model)
    logger.debug(
        "add_batch chunks=%d model=%s embed_total_ms=%.1f%s",
        len(texts),
        model_norm,
        embed_ms,
        session_log_tag(session_id),
    )
    base_metas = metadatas or [{}] * len(texts)
    final_metas = []
    for m in base_metas:
        mm = dict(m or {})
        mm["session_id"] = session_id
        if not mm:
            mm = {"_": 0}
        final_metas.append(mm)

    collection.upsert(ids=ids, embeddings=vectors, documents=texts, metadatas=final_metas)


def search(
    query: str,
    top_k: int | None = None,
    session_id: str = "default",
    embedding_model: str | None = None,
) -> list[dict]:
    """Return top_k chunks for the query. Each item has 'document', 'metadata', 'distance'."""
    collection = _get_collection(embedding_model)
    k = top_k if top_k is not None else TOP_K
    qvec = embed(query, model=embedding_model)
    results = collection.query(
        query_embeddings=[qvec],
        n_results=k,
        where={"session_id": session_id},
        include=["documents", "metadatas", "distances"]
    )

    docs = results.get("documents", [])
    if not docs or not docs[0]:
        return []

    out = []
    for i, doc in enumerate(docs[0]):
        out.append({
            "document": doc,
            "metadata": (results.get("metadatas", [[]])[0] or [{}])[i],
            "distance": (results.get("distances", [[]])[0] or [0])[i],
        })
    return out


def session_has_source(session_id: str, source_name: str) -> bool:
    """True if this session has at least one chunk from the given source filename."""
    if not session_id or not source_name:
        return False
    try:
        for col in _iter_rag_collections():
            res = col.get(
                where={
                    "$and": [
                        {"session_id": {"$eq": session_id}},
                        {"source": {"$eq": source_name}},
                    ]
                },
                limit=1,
            )
            ids = res.get("ids") or []
            if len(ids) > 0:
                return True
        return False
    except Exception:
        return False


def delete_session(session_id: str) -> int:
    total = 0
    for col in _iter_rag_collections():
        res = col.get(where={"session_id": session_id})
        ids = res.get("ids", []) if res else []
        if ids:
            col.delete(ids=ids)
            total += len(ids)
    return total


def delete_session_source(session_id: str, source: str) -> int:
    """Delete all chunks for one source file in one session."""
    if not session_id or not source:
        return 0
    
    # Explicit boolean filter
    where_filter = {
        "$and": [
            {"session_id": {"$eq": session_id}},
            {"source": {"$eq": source}},
        ]
    }

    total = 0
    try:
        for col in _iter_rag_collections():
            try:
                res = col.get(where=where_filter)
                ids = res.get("ids", []) if res else []
                if ids:
                    col.delete(ids=ids)
                    total += len(ids)
                continue
            except Exception:
                pass

            # Fallback: get session rows, then filter by source
            res = col.get(where={"session_id": session_id})
            ids = []
            if res:
                all_ids = res.get("ids", []) or []
                metas = res.get("metadatas", []) or []
                for i, meta in enumerate(metas):
                    if isinstance(meta, dict) and meta.get("source") == source and i < len(all_ids):
                        ids.append(all_ids[i])
            if ids:
                col.delete(ids=ids)
                total += len(ids)
        return total
    except Exception as e:
        raise RuntimeError(
            f"delete_session_source failed for session_id={session_id}, source={source}: {e}"
        ) from e