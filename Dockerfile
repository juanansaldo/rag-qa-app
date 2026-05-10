# FastAPI backend — Ollama runs on the host (or another service); see docker-compose.yml.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY pytest.ini .

ENV PYTHONPATH=/app

EXPOSE 8000

# App uses structured middleware logging (rag.http); disable uvicorn's duplicate access log.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
