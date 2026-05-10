# RAG Q&A

Ask questions over **your own PDFs and notes** using local models—nothing leaves your machine.

You only need **[Docker](https://docs.docker.com/get-docker/)** (with Compose) and **[Ollama](https://ollama.com/)** running on your computer. No Python, Node, or conda required.

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

---

## 3. Run the app

```bash
git clone <repository-url>
cd rag-qa
docker compose up --build
```

Wait until the logs show the API and web containers running. Then open:

**[http://localhost:8080](http://localhost:8080)** — that’s the full UI.

- API docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)

Stop with `Ctrl+C`. Start again anytime with `docker compose up` (omit `--build` if nothing changed).

---

## Tips

| Topic | Notes |
|--------|--------|
| **Where files go** | Uploaded documents are stored under `./data` next to the repo. Search indexes live in Docker volume **`vector_store`** (your vectors persist across restarts). |
| **Large PDFs** | Uploads are allowed up to **100MB** through the UI proxy. |
| **Logs** | `docker compose logs -f api` — see request timing, ingest, and RAG steps. Set `LOG_LEVEL=DEBUG` in a `.env` file (copy from `.env.example`) for more detail. |
| **Models live in Ollama** | The stack talks to Ollama on your host (`host.docker.internal`). Keep Ollama running while you use the app. |

Optional config: copy `.env.example` to `.env` if you want to tweak defaults (e.g. `LOG_LEVEL`). Compose already points the API container at your host Ollama—you don’t need to set `OLLAMA_BASE_URL` yourself for Docker.

---

## If something fails

- **`docker: command not found` (in WSL)** — Install Docker Desktop on Windows and enable WSL integration for your distro, or install Docker inside WSL.
- **Queries / ingest errors about models** — Run `ollama pull <model-name>` for the model shown in the error.
- **Can’t reach Ollama from containers** — Confirm Ollama is running on the host (`ollama list`). On Linux without Docker Desktop, you may need extra networking setup for `host.docker.internal`; using Docker Desktop on Windows/macOS usually works out of the box.

---

## Supported file types

PDF, TXT, MD, HTML, CSV, DOCX.

---

## API

Interactive docs: **http://localhost:8000/docs** once the stack is up.

---

## Contributing / developing from source

If you’re modifying Python or React code, clone the repo and run the backend and frontend locally (Python 3.11+, `pip install -r requirements.txt`, `uvicorn app.main:app --reload`, and in `frontend/` run `npm install` && `npm run dev`). Tests: `pytest` from the repo root (some tests expect Ollama). CI details live under `.github/workflows/`.
