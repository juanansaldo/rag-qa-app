"""Application logging: call configure_logging() once at process startup."""

import hashlib
import logging
import sys

from app.config import LOG_LEVEL


def session_log_tag(session_id: str | None) -> str:
    """Stable short token for logs (SHA-256 prefix); correlates requests without logging raw IDs."""
    if not session_id:
        return ""
    h = hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:8]
    return f" sess={h}"


def preview_text(text: str, max_len: int = 120) -> str:
    """Trim text for logs — avoids dumping full documents or prompts."""
    t = (text or "").replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def configure_logging() -> None:
    level_name = (LOG_LEVEL or "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    # Quieter third-party loggers at INFO unless user turns DEBUG on everything.
    if level > logging.DEBUG:
        logging.getLogger("chromadb").setLevel(logging.WARNING)
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
