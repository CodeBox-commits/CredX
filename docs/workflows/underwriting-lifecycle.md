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

## Phase 1 Notes

- The pipeline is intentionally monolithic but modular.
- Heavy external integrations are stubbed behind stable contracts so later phases can add real providers without redesigning the API.
- Current scoring is transparent and deterministic by design; model artifact loading can be plugged into `backend/app/scoring/inference` later.
