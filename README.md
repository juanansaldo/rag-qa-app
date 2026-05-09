# RAG Q&A

Local retrieval-augmented Q&A for coursework/research documents.

- Upload docs per chat/workspace.
- Keep context isolated by `X-Session-ID`.
- Query with selectable LLM + embedding models.
- Manage docs in-session (preview, open, delete from context).

## Current behavior (important)

- **No TTL cleanup. No SQLite session DB.**
- Sessions are logical workspaces driven by `X-Session-ID` + frontend workspace state.
- Embedding models are isolated in separate Chroma collections to avoid dimension mismatch.
- UI supports multiple chats, per-chat document lists, rename/delete chats, and pending answer state.

## Stack

- API: FastAPI
- Vector DB: Chroma (persistent, cosine)
- Models: Ollama
  - LLM generation model selectable in UI/API
  - Embedding model selectable in UI/API
- Frontend: React + Vite

## Setup

1. Create env and install deps

```bash
conda create -n rag python=3.11 -y
conda activate rag
pip install -r requirements.txt
```

2. Copy env file

```bash
cp .env.example .env
```

3. Pull models you want

```bash
ollama pull mistral
ollama pull nomic-embed-text
# optional
ollama pull mxbai-embed-large
ollama pull snowflake-arctic-embed
```

4. Run backend

```bash
uvicorn app.main:app --reload
```

5. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Defaults

- Top K default: `4`
- Word chunking default: enabled in UI
- LLM default preference in UI: `mistral` (if available)
- Embedding default preference in UI: `nomic-embed-text` (if available)

## API

All ingest/query/delete operations are session-scoped with `X-Session-ID`.

- `GET /health`
- `GET /models` -> locally available Ollama model names (normalized, no tag suffix)
- `POST /ingest/file`
- `POST /ingest/files`
- `POST /query`
- `DELETE /session`
- `DELETE /document?name=<filename>`
- `GET /document/preview?name=<filename>`
- `GET /document/file?name=<filename>&session_id=<id>` (or header)

### Ingest options

`/ingest/file` and `/ingest/files` accept form fields:

- `chunk_size`
- `chunk_overlap`
- `chunk_by_words` (`true`/`false`)
- `embedding_model`

### Query options

`/query` accepts JSON:

```json
{
  "question": "What are the key findings?",
  "top_k": 4,
  "model": "mistral",
  "embedding_model": "nomic-embed-text"
}
```

## Model selection notes

- LLM model is used for answer generation.
- Embedding model is used for both ingest embeddings and query embeddings.
- Best results require querying with the same embedding model used when ingesting that document set.
- If a selected model is missing, UI surfaces a helpful message with `ollama pull <model>`.

## Supported file types

- PDF
- TXT
- MD
- HTML
- CSV
- DOCX

## Project layout

- `app/main.py` - API routes
- `app/config.py` - env-driven config
- `app/embedding.py` - embedding calls
- `app/store.py` - Chroma collections/search/delete
- `app/query.py` - RAG pipeline
- `app/ingest.py` - load/chunk/store
- `app/loaders.py` - file readers
- `frontend/` - React app UI
- `tests/` - pytest suite

## Tests

From repo root:

```bash
pytest
```