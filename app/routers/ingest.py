import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.deps import SessionId
from app.documents_util import ALLOWED_EXTENSIONS
from app.ingest import ingest_file

logger = logging.getLogger("rag.api")

router = APIRouter(tags=["ingest"])


@router.post("/ingest/file")
async def ingest_upload(
    session_id: SessionId,
    file: UploadFile = File(...),
    chunk_size: int | None = Form(default=None),
    chunk_overlap: int | None = Form(default=None),
    chunk_by_words_raw: str | None = Form(default=None),
    embedding_model: str | None = Form(default=None),
):
    """Upload a single file (PDF, TXT, MD); chunk and add to vector store."""
    if not file.filename:
        logger.warning("ingest rejected session=%s reason=no_filename", session_id)
        raise HTTPException(status_code=400, detail="No filename")

    path = Path("data") / file.filename
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        logger.warning(
            "ingest rejected session=%s file=%s reason=unsupported_suffix suffix=%s",
            session_id,
            file.filename,
            path.suffix,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {path.suffix}",
        )

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


@router.post("/ingest/files")
async def ingest_upload_batch(
    session_id: SessionId,
    files: list[UploadFile] = File(default=[]),
    chunk_size: int | None = Form(default=None),
    chunk_overlap: int | None = Form(default=None),
    chunk_by_words_raw: str | None = Form(default=None),
    embedding_model: str | None = Form(default=None),
):
    """Upload multiple files; chunk and add to vector store. Returns total and per-file counts."""
    if not files:
        logger.warning("ingest_files rejected session=%s reason=no_files", session_id)
        raise HTTPException(
            status_code=400,
            detail="No files uploaded",
        )

    total_chunks = 0
    file_results = []

    for file in files:
        if not file.filename:
            logger.warning("ingest_files skipped session=%s reason=no_filename", session_id)
            file_results.append({"filename": "", "chunks_added": 0, "error": "No filename"})
            continue

        path = Path("data") / file.filename
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            logger.warning(
                "ingest_files skipped session=%s file=%s reason=unsupported_suffix suffix=%s",
                session_id,
                file.filename,
                path.suffix,
            )
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
