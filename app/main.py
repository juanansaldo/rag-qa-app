from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.logging_setup import configure_logging

configure_logging()

from app.http_middleware import RequestLoggingMiddleware
from app.routers import documents, health, ingest, models, query, session

_settings = get_settings()

app = FastAPI(title="RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(health.router)
app.include_router(models.router)
app.include_router(ingest.router)
app.include_router(query.router)
app.include_router(session.router)
app.include_router(documents.router)
