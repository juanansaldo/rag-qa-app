import logging
import time

import ollama
from app.config import LLM_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger("rag.llm")


def generate(system_prompt: str, user_prompt: str, model: str | None = None) -> str:
    """Call Ollama chat. Uses model from config if model is None. Returns the model's reply text."""
    client = ollama.Client(host=OLLAMA_BASE_URL)
    model_name = model if model is not None else LLM_MODEL
    t0 = time.perf_counter()
    response = client.chat(
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    text = response["message"]["content"].strip()
    ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "llm_chat model=%s ms=%.1f reply_chars=%d context_chars=%d",
        model_name,
        ms,
        len(text),
        len(user_prompt or ""),
    )
    return text