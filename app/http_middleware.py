"""HTTP request timing middleware."""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_setup import session_log_tag

logger = logging.getLogger("rag.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        sess = session_log_tag(request.headers.get("x-session-id"))
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "%s %s failed after %.1fms%s",
                request.method,
                request.url.path,
                elapsed_ms,
                sess,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        path = request.url.path
        msg = "%s %s -> %s %.1fms%s"
        args = (request.method, path, response.status_code, elapsed_ms, sess)
        if path == "/health" or path == "/health/ready":
            logger.debug(msg, *args)
        else:
            logger.info(msg, *args)
        return response
