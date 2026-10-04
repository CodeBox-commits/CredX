# Local Stack

## Frontend

- App root: `frontend/`
- Dev server: `npm run dev`
- Build output: `dist/`

## Backend

- Entry point: `backend/app/main.py`
- Start command:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Full Docker Stack

```bash
cp .env.example .env
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
