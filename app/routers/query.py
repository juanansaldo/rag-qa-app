import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.deps import SessionId
from app.query import rag_query

logger = logging.getLogger("rag.api")

router = APIRouter(tags=["query"])


class QueryRequest(BaseModel):
    question: str
    top_k: int | None = None
    model: str | None = None
    embedding_model: str | None = None


@router.post("/query")
def query_route(req: QueryRequest, session_id: SessionId):
    """Ask a question; returns answer and source chunks."""
    try:
        return rag_query(
            req.question,
            session_id=session_id,
            top_k=req.top_k,
            model=req.model,
            embedding_model=req.embedding_model,
        )

    except Exception as e:
        logger.exception("query failed session=%s", session_id)
        return {"answer": "", "sources": [], "error": str(e)}
