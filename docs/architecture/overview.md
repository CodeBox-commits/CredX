# Architecture overview

CredX is a **modular monolith**: one FastAPI codebase organised by business domain, deployed as two
processes (API + Celery worker) from a single Docker image, plus a Next.js frontend. This keeps the
operational surface of a hackathon project while preserving the seams needed to split services later.

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js 15 App Router<br/>React Query · shadcn/ui · Recharts · d3-force]
  end
  UI -- "/api/v1/* (same-origin rewrite)" --> API

  subgraph Backend["backend/ (one image)"]
    API[FastAPI<br/>auth · RBAC · validation · audit]
    W[Celery worker<br/>or in-process thread pool]
    API -- enqueue job --> Q[(Redis / Upstash)]
    Q --> W
    subgraph Engines
      EX[extraction<br/>pdfplumber · PyMuPDF · Camelot · Tesseract]
      RS[research<br/>NewsAPI · SerpAPI · RSS · sector KB]
      FR[fraud<br/>NetworkX graph · GST rules]
      SC[scoring<br/>XGBoost · TreeSHAP · policy · sizing · pricing]
      CAM[cam<br/>Jinja2 · ReportLab · python-docx]
      AI[ai<br/>Claude · OpenAI · Gemini · local]
    end
    W --> EX & RS & FR & SC & CAM
    API --> AI
  end

  API & W --> DB[(PostgreSQL / Supabase)]
  API & W --> S3[(S3 / local storage)]
```

## Layering inside `backend/`

| Layer | Responsibility | Depends on |
|---|---|---|
| `api/` | HTTP contracts, auth guards, request validation, audit calls | services, schemas |
| `services/` | Use-case orchestration: case context assembly, job handlers, audit | engines, models |
| `workers/` | Job execution (status, progress, retries, metrics) and dispatch strategy | services |
| `extraction/ research/ fraud/ scoring/ cam/ ai/` | **Pure domain engines** — functions of their inputs, no DB access | config, utils |
| `models/ database/` | SQLAlchemy 2.0 models, sessions, migrations, seed | — |
| `core/ config/ utils/ middleware/` | Settings, logging, errors, security, cache, retry, metrics, storage, India utils | — |

The engines never touch the database, so they run identically inside a request, a thread, a Celery
worker or a unit test. `services/case_context.py` is the single place that turns database rows into
the dictionaries the engines consume.

## Async pipeline

```mermaid
sequenceDiagram
  participant U as Analyst
  participant A as API
  participant J as Job runner
  U->>A: POST /cases/{id}/documents (n files, auto_analyze)
  A->>A: validate (ext, magic bytes, size, active-content), dedupe by SHA-256, store
  A-->>U: 202 + n ingest jobs
  loop each document (parallel)
    J->>J: text layer → OCR fallback → tables → classify → extract → normalise → persist
  end
  J->>J: last document settled → enqueue full_analysis
  J->>J: research → fraud graph → score + SHAP → CAM (steps tracked)
  U->>A: GET /jobs/{id} (polled by the UI, progress & step states)
```

`JOB_BACKEND` selects the dispatcher: `celery` (Redis broker, prefork workers — production),
`thread` (in-process pool, zero infrastructure — demos and free tiers) or `inline` (tests). Native
PDF libraries are not thread-safe, so all PDF work holds a process-wide lock (`extraction/parsers/pdf.py`);
Celery's process isolation makes this a no-op in production.

## Data model

```mermaid
erDiagram
  USERS ||--o{ CREDIT_CASES : "creates / is assigned"
  COMPANIES ||--o{ CREDIT_CASES : has
  CREDIT_CASES ||--o{ DOCUMENTS : contains
  CREDIT_CASES ||--o{ FINANCIAL_STATEMENTS : "per fiscal year"
  CREDIT_CASES ||--o{ GST_FILINGS : ""
  CREDIT_CASES ||--o{ BANK_STATEMENT_SUMMARIES : ""
  CREDIT_CASES ||--o{ RESEARCH_REPORTS : versions
  RESEARCH_REPORTS ||--o{ RESEARCH_FINDINGS : cites
  CREDIT_CASES ||--o{ FRAUD_ANALYSES : versions
  FRAUD_ANALYSES ||--o{ FRAUD_ALERTS : raises
  CREDIT_CASES ||--o{ CREDIT_SCORES : "immutable versions"
  CREDIT_CASES ||--o{ CAM_REPORTS : versions
  CREDIT_CASES ||--o{ ANALYST_NOTES : "threaded"
  CREDIT_CASES ||--o{ MANUAL_OVERRIDES : "maker-checker"
  CREDIT_CASES ||--o{ ESCALATIONS : ""
  CREDIT_CASES ||--o{ JOBS : ""
  CREDIT_CASES ||--o{ COPILOT_MESSAGES : ""
  AUDIT_LOGS }o--|| USERS : actor
```

Twenty tables, UUID keys, `created_at/updated_at` everywhere, enums stored as strings (no `ALTER TYPE`
migrations), JSON columns (`JSONB` on Postgres) for engine payloads. Every engine output is
**versioned and append-only** (scores, research, fraud, CAMs) so a credit committee can always see
what the analyst saw when they decided. Migrations live in `backend/alembic/`; CI asserts
`alembic check` (models and migrations never drift).

## Key decisions

| Decision | Why |
|---|---|
| Modular monolith, not microservices | One deploy unit + one worker. Domains are packages with clean boundaries, so extracting e.g. `extraction` into its own service is a move, not a rewrite. |
| Sync SQLAlchemy 2.0 | Same code path for API routes (FastAPI threadpool) and Celery tasks; async adds complexity with no throughput benefit for a CPU-bound OCR/ML workload. |
| XGBoost + native TreeSHAP | Exact Shapley values from the booster (`pred_contribs`) — no `shap`/pandas at serving time, millisecond explanations. |
| PDO-scaled scores | Log-odds → points is linear, so SHAP values convert to *exact* score points; the waterfall always reconciles. |
| Overlays, not retraining, for qualitative evidence | Analyst notes and unmodelled red flags adjust the score as bounded, cited overlays — visible, reversible, auditable. |
| NetworkX now, Neo4j-ready | Graph built with a Neo4j-compatible property model; `GraphStore` interface + Cypher export make migration mechanical. |
| Local grounded LLM fallback | The copilot works offline and never invents numbers; real LLMs are an upgrade, not a dependency. |
| Same-origin API via Next rewrites | No CORS in the browser, secure cookies possible later, and Vercel → Railway/Render wiring is one env var. |
