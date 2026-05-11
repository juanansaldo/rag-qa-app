from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query


def get_session_id(
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
) -> str:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")
    return x_session_id


def get_session_id_header_or_query(
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
    session_id_q: str | None = Query(default=None, alias="session_id"),
) -> str:
    sid = x_session_id or session_id_q
    if not sid:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Session-ID header or session_id query parameter",
        )
    return sid


SessionId = Annotated[str, Depends(get_session_id)]
SessionIdHeaderOrQuery = Annotated[str, Depends(get_session_id_header_or_query)]
