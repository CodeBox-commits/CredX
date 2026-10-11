# Local stack

## One command (recommended)

```bash
node scripts/dev.mjs setup   # once: backend/.venv, pip + npm installs, demo seed
node scripts/dev.mjs dev     # API http://localhost:8000 (docs at /docs) + web http://localhost:3000
node scripts/dev.mjs test    # pytest + vitest
```

## Backend by hand

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env          # optional — defaults work without it
python -m database.seed         # demo users + five analysed borrowers (SQLite at storage/credx.db)
uvicorn main:app --reload --port 8000
```

`JOB_BACKEND=thread` (default) runs ingestion/analysis jobs inside the API process, so no Redis is
needed locally. Install Tesseract to enable OCR for scanned PDFs (`/health/ready` reports whether it
was found).

## Frontend by hand

```bash
cd frontend
npm install
npm run dev                     # proxies /api/v1/* to BACKEND_URL (default http://localhost:8000)
```

Set `NEXT_PUBLIC_DEMO_MODE=true` in `frontend/.env.local` to run the UI without any backend.

## Docker

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:8000 (`/docs`, `/health/ready`, `/metrics`) |
| Postgres | internal (`postgres:5432`) |
| Redis | internal (`redis:6379`) |

The API container runs `alembic upgrade head`, seeds the demo portfolio once, then serves; the
`worker` container processes jobs from Redis via Celery.
