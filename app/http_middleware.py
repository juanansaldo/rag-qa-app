"""HTTP request timing middleware."""

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("rag.http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "%s %s failed after %.1fms",
                request.method,
                request.url.path,
                elapsed_ms,
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        path = request.url.path
        msg = "%s %s -> %s %.1fms"
        args = (request.method, path, response.status_code, elapsed_ms)
        if path == "/health":
            logger.debug(msg, *args)
        else:
            logger.info(msg, *args)
        return response
