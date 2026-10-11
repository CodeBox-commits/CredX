# Underwriting Lifecycle

## Core Flow

1. Upload source documents in the ingestion workspace.
2. Run hybrid text extraction with parser and OCR fallback where available.
3. Classify document type and extract financial entities into structured JSON.
4. Attach research intelligence for promoter, sector, litigation, and regulatory context.
5. Run fraud checks for GST mismatch, revenue inflation, circular trading, and relationship watch.
6. Generate underwriting decision output with:
   - score
   - probability
   - pricing
   - Five Cs
   - decision trace
7. Build committee-ready CAM preview sections.
8. Use copilot for explanation and analyst support.

## How the pieces run

- Uploads return immediately with one `ingest_document` job per file; jobs run on Celery (production), an
  in-process thread pool (single container) or inline (tests) — `JOB_BACKEND` selects which.
- With `auto_analyze=true`, the case starts `full_analysis` (research → fraud → scoring → CAM) as soon as
  every document has settled; each step updates the job's `steps[]` so the UI shows live progress.
- The database is the source of truth: analyst edits to financials, notes and overrides are read back by
  every engine on the next run, and every score and CAM is versioned.
- The web app polls active jobs and refreshes the affected views when they finish; with
  `NEXT_PUBLIC_DEMO_MODE=true` the same UI runs against an in-browser simulation of the API.
