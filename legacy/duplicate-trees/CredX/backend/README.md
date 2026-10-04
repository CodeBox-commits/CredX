# CredX Backend

The backend is now organized as one modular FastAPI application for an AI-native underwriting platform.

## Modules

- `app/api` - route layer and API contracts
- `app/core` - app factory, settings, logging, and error handling
- `app/extraction` - ingestion pipeline, classification, OCR fallback, financial entity parsing
- `app/research` - promoter, litigation, sentiment, and sector intelligence synthesis
- `app/fraud` - GST rules, relationship graph output, and fraud scoring
- `app/scoring` - feature engineering, transparent decision logic, and explainability trace
- `app/cam` - CAM preview generation
- `app/ai` - provider abstraction and copilot orchestration

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Key endpoints

- `GET /health`
- `GET /api/v1/platform`
- `POST /api/v1/uploads/single`
- `POST /api/v1/uploads/multiple`
- `POST /api/v1/research/intelligence`
- `POST /api/v1/fraud/analyze`
- `POST /api/v1/underwriting/score`
- `POST /api/v1/cam/preview`
- `POST /api/v1/copilot/chat`
