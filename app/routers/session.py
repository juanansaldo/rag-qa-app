import logging

from fastapi import APIRouter

from app.deps import SessionId
from app.store import delete_session

logger = logging.getLogger("rag.api")

router = APIRouter(tags=["session"])


@router.delete("/session")
def clear_session(session_id: SessionId):
    """Remove all embedded chunks for this session/workspace from the vector store."""
    removed = delete_session(session_id)
    logger.info("delete_session session=%s deleted_chunks=%s", session_id, removed)
    return {"ok": True, "deleted_chunks": removed}
