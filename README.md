# CredX

CredX is an AI-powered corporate credit intelligence platform for Indian underwriting teams. The repository is being evolved into a deployable operating system for document ingestion, research intelligence, fraud screening, explainable decisioning, CAM generation, and analyst copilot workflows.

## Phase 1 Delivered

- `frontend/` application boundary with the existing premium underwriting UI preserved
- theme support and command palette for faster analyst navigation
- modular FastAPI backend foundation across ingestion, research, fraud, scoring, CAM, and copilot domains
- Docker, CI, environment templates, backend tests, and architecture docs
- India-specific extraction and fraud heuristics including GST mismatch and circular-trading watch rules

## Repository Shape

```text
CredX/
├── frontend/
│   └── src/
├── backend/
│   └── app/
├── docs/
├── docker/
├── scripts/
└── .github/
```

## Local Development

### Frontend

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:8080`.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs on `http://localhost:8000`.

### Full stack with Docker

```bash
copy .env.example .env
docker compose up --build
```

## Key API Endpoints

- `POST /api/v1/uploads/multiple`
- `POST /api/v1/research/intelligence`
- `POST /api/v1/fraud/analyze`
- `POST /api/v1/underwriting/score`
- `POST /api/v1/cam/preview`
- `POST /api/v1/copilot/chat`

## Architecture Notes

- The strongest ideas from `Intelli_credit_platform`, `Slice-Credit-Scoring-Engine`, `CreditMind`, and `CogniCam` were synthesized into one cleaner modular backend instead of separate fragile services.
- Explainability is a first-class concern: structured extraction, decision factors, Five Cs, pricing rationale, and fraud alerts all remain visible in API responses.
- The current scoring path is intentionally transparent and deterministic so later XGBoost and SHAP artifacts can be added without breaking API contracts.

See [Reference Synthesis](docs/architecture/reference-synthesis.md), [Underwriting Lifecycle](docs/workflows/underwriting-lifecycle.md), and [Local Stack](docs/deployment/local-stack.md).
