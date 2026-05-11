from pathlib import Path

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".html", ".csv", ".docx"}


def safe_data_path(filename: str) -> Path | None:
    if not filename or filename != Path(filename).name or ".." in filename:
        return None
    path = Path("data") / filename
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        return None
    return path


def preview_text_file(path: Path, max_chars: int = 4000) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n…"
    return text


def preview_pdf_first_page(path: Path, max_chars: int = 3000) -> str:
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
