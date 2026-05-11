import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

from app.deps import SessionId, SessionIdHeaderOrQuery
from app.documents_util import preview_pdf_first_page, preview_text_file, safe_data_path
from app.store import delete_session_source, session_has_source

logger = logging.getLogger("rag.api")

router = APIRouter(tags=["documents"])


@router.delete("/document")
def delete_document_route(
    session_id: SessionId,
    name: str = Query(...),
):
    """Remove all chunks for one document from this session/workspace."""
    removed = delete_session_source(session_id=session_id, source=name)
    logger.info(
        "delete_document session=%s name=%s deleted_chunks=%s",
        session_id,
        name,
        removed,
    )
    return {"ok": True, "deleted_chunks": removed, "name": name}


@router.get("/document/preview")
def document_preview_route(
    sid: SessionIdHeaderOrQuery,
    name: str = Query(...),
):
    if not session_has_source(sid, name):
        raise HTTPException(status_code=404, detail="Document not in this session")
    path = safe_data_path(name)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")
    suf = path.suffix.lower()
    if suf in (".txt", ".md", ".csv", ".html"):
        preview = preview_text_file(path)
        kind = "text"
    elif suf == ".pdf":
        preview = preview_pdf_first_page(path)
        kind = "pdf"
    elif suf == ".docx":
        try:
            from docx import Document as DocxDocument

            doc = DocxDocument(str(path))
            parts = [p.text for p in doc.paragraphs if p.text.strip()]
            full = "\n\n".join(parts)
            preview = full[:4000] + ("\n\n…" if len(full) > 4000 else "")
            kind = "text"
        except Exception as e:
            preview = f"Could not preview DOCX: {e}"
            kind = "text"
    else:
        preview = "No text preview for this type."
        kind = "text"
    return JSONResponse({"name": name, "preview": preview, "kind": kind})


@router.get("/document/file")
def document_file_route(
    sid: SessionIdHeaderOrQuery,
    name: str = Query(...),
):
    if not session_has_source(sid, name):
        raise HTTPException(status_code=404, detail="Document not in this session")
    path = safe_data_path(name)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")
    media = {
        ".pdf": "application/pdf",
        ".txt": "text/plain; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    mt = media.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=mt, filename=path.name)
