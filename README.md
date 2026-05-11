# RAG Q&A

Ask questions over **your own PDFs and notes** using local models—nothing leaves your machine.

You only need **[Docker](https://docs.docker.com/get-docker/)** (with Compose) and **[Ollama](https://ollama.com/)** running on your computer. You do **not** need a separate Python or Node install for day-to-day use.

---

## 1. Install Ollama (on your PC, not in Docker)

Download and install Ollama, then start it (it usually runs in the background). Pull the models the app will use:

```bash
ollama pull mistral
ollama pull nomic-embed-text
```

You can add more later (`ollama pull llama3.2`, etc.) and pick them in the app.

---

## 2. Install Docker

- **Windows / macOS:** [Docker Desktop](https://docs.docker.com/desktop/) — enable **WSL 2** on Windows and, under Docker Desktop → **Settings → Resources → WSL integration**, turn on your Linux distro if you use WSL.
- **Linux:** Docker Engine + Compose plugin.

Docker must be **running** before `docker compose` works (`docker info` should succeed).

---

## 3. Run the app

```bash
git clone <repository-url>
cd rag-qa
docker compose up --build
```

Wait until the API and web containers are running. Then open:

**[http://localhost:8080](http://localhost:8080)** — full UI (nginx proxies **`/api`** to the backend).

| URL | Purpose |
|-----|---------|
| **http://localhost:8080** | Web UI |
| **http://localhost:8080/api/docs** | OpenAPI (Swagger) via nginx |
| **http://localhost:8000/docs** | OpenAPI against the API container directly |

Stop with `Ctrl+C`. Start again with `docker compose up` (omit `--build` if nothing changed).

**Question queue:** While a reply is loading, you can submit more questions—they run **sequentially** (FIFO). The status line shows how many are waiting. **Switching chats** clears any queued questions for the pipeline tied to the previous chat.

---

## Health checks

Use these for orchestration or manual troubleshooting.

| Endpoint | Meaning |
|----------|---------|
| **`GET /health`** | **Liveness** — process is up (cheap; fine for frequent pings). |
| **`GET /health/ready`** | **Readiness** — vector store directory is writable **and** Ollama’s API responds. Returns **503** if not ready (e.g. Ollama stopped). |

Behind the UI proxy:

- `http://localhost:8080/api/health`
- `http://localhost:8080/api/health/ready`

Prefer **`/health`** for high-frequency probes and **`/health/ready`** less often (the readiness check talks to Ollama).

---

## Configuration

Copy **`.env.example`** to **`.env`** and adjust as needed. Important variables:

| Variable | Role |
|----------|------|
| `OLLAMA_BASE_URL` | Ollama HTTP API (Compose defaults to `http://host.docker.internal:11434` inside the API container). |
| `VECTOR_STORE_PATH` | Chroma persistence path (Compose uses `/app/vector_store` in the container). |
| `LOG_LEVEL` | `DEBUG`, `INFO`, etc. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed by the API (defaults match local Vite + Docker UI). |

Uploaded files are stored under **`./data`** on the host. Search indexes persist in the **`vector_store`** Docker volume across restarts.

Large uploads through the UI are allowed up to **100 MB** (see `frontend/nginx.conf`).

---

## API behavior (errors)

Endpoints align with common FastAPI patterns:

| Situation | Typical response |
|-----------|-------------------|
| Missing **`X-Session-ID`** on routes that require it | **400** with `detail` (JSON). |
| Invalid ingest input (e.g. no file, wrong extension, empty batch) | **400** with `detail`. |
| Query / ingest failures after validation | Often **200** with a JSON body containing **`error`** (or empty answer / sources), so the UI can show a message without treating HTTP as fatal. |

Interactive docs list full schemas: **`/docs`**.

---

## Tests

Python dependencies are **pinned** in **`requirements.txt`** for reproducible installs.

**Integration** tests (live Ollama embeddings) are marked **`@pytest.mark.integration`** and are **skipped in CI** by default.

```bash
# Same environment as CI — unit + API tests only
pytest -q -m "not integration"

# Live embeddings / Chroma (requires Ollama reachable at OLLAMA_BASE_URL)
pytest -q -m integration
```

### Run tests **only with Docker** (no host Python env)

From the repo root (Docker Desktop running):

```bash
docker compose --profile test build test
docker compose --profile test run --rm test
```

Optional one-liner after the image exists:

```bash
docker compose --profile test run --rm test pytest -q -m integration
```

---

## CI (GitHub Actions)

Workflow **`.github/workflows/ci.yml`** runs on **`push`** to **`main`**, **pull requests**, and **`workflow_dispatch`** (manual run):

1. **`test`** — `pip install -r requirements.txt`, then **`pytest -m "not integration"`**.
2. **`docker-test`** — builds the **`test`** Compose service and runs pytest **inside** the container (matches local Docker workflow).
3. **`docker-build`** — builds **API + web** images (`docker compose build`).

**Dependabot** is configured for **pip**, **npm** (`frontend/`), and **GitHub Actions** (see `.github/dependabot.yml`).

---

## Supported file types

PDF, TXT, MD, HTML, CSV, DOCX.

---

## Troubleshooting

- **`docker: command not found` (in WSL)** — Install Docker Desktop on Windows and enable WSL integration for your distro, or install Docker Engine inside WSL.
- **Cannot connect to Docker pipe / engine** — Start Docker Desktop and wait until it is fully running.
- **Queries / ingest errors about models** — Run `ollama pull <model-name>` for the model shown in the error.
- **Containers cannot reach Ollama** — Confirm Ollama is running (`ollama list`). Compose maps **`OLLAMA_BASE_URL`** to the host; on Linux without Docker Desktop you may need extra networking instead of `host.docker.internal`.
- **Readiness always 503** — Check Ollama is up and **`OLLAMA_BASE_URL`** from inside the API container reaches your host.

---

## Contributing / developing from source

For UI or Python changes you can run processes locally:

- **Backend:** Python **3.11+**, `pip install -r requirements.txt`, `uvicorn app.main:app --reload`.
- **Frontend:** in **`frontend/`**, `npm install` and `npm run dev`.

The UI expects the API at **`VITE_API_URL`** (e.g. proxy to `http://127.0.0.1:8000` or `/api` depending on setup).
