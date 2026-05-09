import ollama
from app.config import EMBEDDING_MODEL, OLLAMA_BASE_URL


def embed(text: str, model: str | None = None) -> list[float]:
    """Embed a single string. Returns a list of floats."""
    client = ollama.Client(host=OLLAMA_BASE_URL)
    out = client.embeddings(model=model or EMBEDDING_MODEL, prompt=text)
    return out["embedding"]


def embed_batch(texts: list[str], model: str | None = None) -> list[list[float]]:
    """Embed multiple strings. Returns a list of embedding vectors."""
    return [embed(t, model=model) for t in texts]