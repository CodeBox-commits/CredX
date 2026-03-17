# CredX Backend (FastAPI)

This backend currently includes:

- FastAPI app setup
- Health check endpoint
- File upload endpoints for single and multiple documents
- PDF parsing via LlamaParse (Step 3)

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add LLAMA_CLOUD_API_KEY in .env
.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `POST /api/v1/uploads/single`
  - Form fields: `file`, optional `company_id`, optional `document_type`
- `POST /api/v1/uploads/multiple`
  - Form fields: `files`, optional `company_id`, optional `document_type`

Uploaded files are stored under `backend/storage/uploads/`.
Parsed PDF artifacts are stored under `backend/storage/parsed/`.

## Step 3 behavior (LlamaParse)

- PDFs are automatically parsed after upload.
- Non-PDF files are uploaded and marked with parse status `skipped`.
- If parser setup fails, upload still succeeds and parse status becomes `failed`.
- Every upload response includes `parse_summary` per file.
