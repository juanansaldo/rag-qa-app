from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cors_origins: str = Field(
        default=(
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "http://localhost:8080,"
            "http://127.0.0.1:8080"
        ),
        description="Comma-separated browser origins allowed by CORS.",
    )

    vector_store_path: Path = Path("./vector_store")
    chunk_size: int = 512
    chunk_overlap: int = 100
    chunk_size_words: int = 100
    chunk_overlap_words: int = 20
    top_k: int = 4
    embedding_model: str = "nomic-embed-text"
    llm_model: str = "mistral"
    ollama_base_url: str = "http://localhost:11434"
    log_level: str = "INFO"

    def cors_origin_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


_settings = Settings()


def get_settings() -> Settings:
    """Process-wide settings singleton (same instance as module-level constants)."""
    return _settings

# Module-level names preserved for existing imports (store, chunking, query, …).
VECTOR_STORE_PATH = _settings.vector_store_path
CHUNK_SIZE = _settings.chunk_size
CHUNK_OVERLAP = _settings.chunk_overlap
CHUNK_SIZE_WORDS = _settings.chunk_size_words
CHUNK_OVERLAP_WORDS = _settings.chunk_overlap_words
TOP_K = _settings.top_k
EMBEDDING_MODEL = _settings.embedding_model
LLM_MODEL = _settings.llm_model
OLLAMA_BASE_URL = _settings.ollama_base_url
LOG_LEVEL = _settings.log_level
