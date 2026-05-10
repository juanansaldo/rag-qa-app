from pathlib import Path

from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.logging_setup import configure_logging

configure_logging()

import logging

from app.http_middleware import RequestLoggingMiddleware
from app.ingest import ingest_file
from app.query import rag_query
from app.store import delete_session, session_has_source, delete_session_source

logger = logging.getLogger("rag.api")

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".html", ".csv", ".docx"}


def _require_session_id(x_session_id: str | None) -> str:
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-ID header")
    return x_session_id


def _safe_data_path(filename: str) -> Path | None:
    if not filename or filename != Path(filename).name or ".." in filename:
        return None
    path = Path("data") / filename
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        return None
    return path


def _preview_text_file(path: Path, max_chars: int = 4000) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n…"
    return text


def _preview_pdf_first_page(path: Path, max_chars: int = 3000) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return "PDF preview unavailable (pypdf not installed)."
    try:
        reader = PdfReader(str(path))
        if not reader.pages:
            return "Empty PDF."
        t = (reader.pages[0].extract_text() or "").strip()
        if len(t) > max_chars:
            t = t[:max_chars] + "…"
        return t or "No extractable text on the first page."
    except Exception as e:
        return f"Could not read PDF: {e}"


app = FastAPI(title="RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/models")
def list_models():
    """List locally available Ollama chat models."""
    try:
        import ollama
        from app.config import OLLAMA_BASE_URL

        client = ollama.Client(host=OLLAMA_BASE_URL)
        raw = client.list()
        models = raw.get("models", []) if isinstance(raw, dict) else []
        names = []
        for m in models:
            n = m.get("name") if isinstance(m, dict) else None
            if n:
                names.append(n.split(":", 1)[0])
        # Keep stable order but unique names.
        out = list(dict.fromkeys(names))
        return {"models": out}
    except Exception as e:
        logger.warning("list_models failed: %s", e)
        return {"models": []}


@app.post("/ingest/file")
async def ingest_upload(
    file: UploadFile = File(...),
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
    chunk_size: int | None = Form(default=None),
    chunk_overlap: int | None = Form(default=None),
    chunk_by_words_raw: str | None = Form(default=None),
    embedding_model: str | None = Form(default=None),
):
    """Upload a single file (PDF, TXT, MD); chunk and add to vector store."""
    session_id = _require_session_id(x_session_id)

    if not file.filename:
        return {"ok": False, "error": "No filename"}

    path = Path("data") / file.filename
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        return {"ok": False, "error": f"Unsupported file type: {path.suffix}"}

    path.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    path.write_bytes(content)
    
    try:
        by_words = True if chunk_by_words_raw is None else str(chunk_by_words_raw).lower() in ("true", "1", "on")
        n = ingest_file(
            path,
            session_id=session_id,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            chunk_by_words=by_words,
            embedding_model=embedding_model,
        )
        logger.info(
            "ingest_file session=%s file=%s chunks=%s embedding_model=%s",
            session_id,
            file.filename,
            n,
            embedding_model,
        )
        return {"ok": True, "chunks_added": n}
    except Exception as e:
        logger.exception(
            "ingest_file failed session=%s file=%s embedding_model=%s",
            session_id,
            file.filename,
            embedding_model,
        )
        return {"ok": False, "error": str(e)}


@app.post("/ingest/files")
async def ingest_upload_batch(
    files: list[UploadFile] = File(default=[]),
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
    chunk_size: int | None = Form(default=None),
    chunk_overlap: int | None = Form(default=None),
    chunk_by_words_raw: str | None = Form(default=None),
    embedding_model: str | None = Form(default=None),
):
    """Upload multiple files (PDF, TXT, MD); chunk and add to vector store. Returns total and per-file counts."""
    session_id = _require_session_id(x_session_id)

    if not files:
        return {"ok": False, "error": "No files", "total_chunks": 0, "files": []}

    total_chunks = 0
    file_results = []

    for file in files:
        if not file.filename:
            file_results.append({"filename": "", "chunks_added": 0, "error": "No filename"})
            continue
        
        path = Path("data") / file.filename
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            file_results.append({
                "filename": file.filename,
                "chunks_added": 0,
                "error": f"Unsupported file type: {path.suffix}",
            })
            continue

        path.parent.mkdir(parents=True, exist_ok=True)
        content = await file.read()
        path.write_bytes(content)
        try:
            by_words = True if chunk_by_words_raw is None else str(chunk_by_words_raw).lower() in ("true", "1", "on")
            n = ingest_file(
                path,
                session_id=session_id,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                chunk_by_words=by_words,
                embedding_model=embedding_model,
            )
            total_chunks += n
            file_results.append({"filename": file.filename, "chunks_added": n})
        except Exception as e:
            logger.exception(
                "ingest batch item failed session=%s file=%s embedding_model=%s",
                session_id,
                file.filename,
                embedding_model,
            )
            file_results.append({"filename": file.filename, "chunks_added": 0, "error": str(e)})

    logger.info(
        "ingest_files session=%s total_chunks=%s files=%s embedding_model=%s",
        session_id,
        total_chunks,
        len(file_results),
        embedding_model,
    )
    return {"ok": True, "total_chunks": total_chunks, "files": file_results}


class QueryRequest(BaseModel):
    question: str
    top_k: int | None = None
    model: str | None = None
    embedding_model: str | None = None


@app.post("/query")
def query(req: QueryRequest, x_session_id: str | None = Header(default=None, alias="X-Session-ID")):
    """Ask a question; returns answer and source chunks."""
    session_id = _require_session_id(x_session_id)

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


@app.delete("/session")
def clear_session(x_session_id: str | None = Header(default=None, alias="X-Session-ID")):
    """Remove all embedded chunks for this session/workspace from the vector store."""
    session_id = _require_session_id(x_session_id)
    removed = delete_session(session_id)
    logger.info("delete_session session=%s deleted_chunks=%s", session_id, removed)
    return {"ok": True, "deleted_chunks": removed}


@app.delete("/document")
def delete_document_route(
    name: str = Query(...),
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
):
    """Remove all chunks for one document from this session/workspace."""
    session_id = _require_session_id(x_session_id)
    removed = delete_session_source(session_id=session_id, source=name)
    logger.info(
        "delete_document session=%s name=%s deleted_chunks=%s",
        session_id,
        name,
        removed,
    )
    return {"ok": True, "deleted_chunks": removed, "name": name}


@app.get("/document/preview")
def document_preview_route(
    name: str = Query(...),
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
    session_id_q: str | None = Query(default=None, alias="session_id"),
):
    sid = _require_session_id(x_session_id or session_id_q)
    if not session_has_source(sid, name):
        raise HTTPException(status_code=404, detail="Document not in this session")
    path = _safe_data_path(name)
    if not path or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server")
    suf = path.suffix.lower()
    if suf in (".txt", ".md", ".csv", ".html"):
        preview = _preview_text_file(path)
        kind = "text"
    elif suf == ".pdf":
        preview = _preview_pdf_first_page(path)
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


@app.get("/document/file")
def document_file_route(
    name: str = Query(...),
    x_session_id: str | None = Header(default=None, alias="X-Session-ID"),
    session_id_q: str | None = Query(default=None, alias="session_id"),
):
    sid = _require_session_id(x_session_id or session_id_q)
    if not session_has_source(sid, name):
        raise HTTPException(status_code=404, detail="Document not in this session")
    path = _safe_data_path(name)
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