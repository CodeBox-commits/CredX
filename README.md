# CredX — AI-powered corporate credit intelligence

CredX takes a corporate borrower from a pile of PDFs to an explainable, committee-ready credit decision:
document ingestion and extraction, secondary research, a fraud graph with GST forensics, an XGBoost +
SHAP credit score with policy rules, loan sizing and pricing, a Credit Appraisal Memo (PDF/DOCX/HTML),
an analyst workspace with maker-checker overrides, and a grounded AI copilot. It is built for Indian
mid-corporate lending (GSTR-2A/2B vs 3B, MCA/ROC, NCLT/IBC, RBI context, lakh/crore formatting).

| Layer | Stack |
|---|---|
| Web | Next.js 15 (App Router), React 19, TypeScript, Tailwind, Radix/shadcn, TanStack Query, Recharts, d3-force |
| API | FastAPI, Python 3.11+, SQLAlchemy 2, Alembic, PostgreSQL (SQLite for local dev) |
| Jobs | Celery + Redis (production) · in-process thread pool (single container) · inline (tests) |
| Documents | pdfplumber, PyMuPDF, Tesseract OCR, Camelot |
| ML | XGBoost with monotone constraints, exact TreeSHAP (`pred_contribs`), PDO score scaling |
| Graph | NetworkX (exportable to Neo4j as Cypher) |
| CAM | Jinja2 (HTML), ReportLab (PDF), python-docx (DOCX) |
| AI | Anthropic Claude → OpenAI → Gemini → deterministic grounded local fallback |

## Quick start

**Fastest look (no backend):** the web app ships an in-browser demo API.

```bash
cd frontend
npm install
echo NEXT_PUBLIC_DEMO_MODE=true > .env.local
npm run dev
```

Open http://localhost:3000 and pick a demo role on the sign-in page.

**Full stack locally** (Python 3.11+, Node 20+). `scripts/dev.mjs` works on Windows, macOS and Linux:

```bash
node scripts/dev.mjs setup   # backend venv + deps, frontend deps, seeds the 5-borrower demo portfolio
node scripts/dev.mjs dev     # API on :8000, web on :3000 (proxies /api/v1 to the API)
```

Demo accounts (password `CredX@2026`): `analyst@credx.demo`, `manager@credx.demo`, `admin@credx.demo`,
`viewer@credx.demo`. The seed runs every borrower's PDFs through the real pipeline; the generated
documents are also in `demo/documents/` so you can upload them yourself and watch extraction live.

**Docker** (Postgres, Redis, API, Celery worker, web):

```bash
docker compose up --build    # optional: copy .env.example to .env to add AI / research API keys
```

## Repository layout

```text
backend/            FastAPI service (run from this directory)
  api/              routes (auth, cases, documents, intelligence, workflow, platform) + dependencies
  core/             settings-backed infrastructure: errors, logging, metrics, security, storage, cache, retry
  config/           environment-driven settings
  database/         engine/session, declarative base, demo portfolio + seed
  models/           SQLAlchemy models (alembic/ holds the migrations)
  extraction/       parsing, OCR, tables, classification, financial/GST/bank/legal extractors, fact merge
  research/         news providers, sentiment, litigation, MCA, sector knowledge base, cited summary
  fraud/            entity graph, detectors (circular trading, shared control, shells), GST forensics
  scoring/          features, XGBoost model registry/trainer, SHAP explainer, policy, overlays, sizing & pricing
  cam/              CAM section builder and HTML/PDF/DOCX renderers
  ai/               provider router, prompts, copilot / narrative services
  services/         job pipeline handlers, case context assembly, audit
  workers/          Celery app, dispatcher, job runner
  tests/            pytest suite (unit + end-to-end API)
frontend/           Next.js app
  app/              routes: landing, login, dashboard, cases, case workspace (overview, documents, financials,
                    intelligence, decision, CAM, workspace, copilot), jobs, admin
  components/       ui/ primitives, common/, case/, decision/, cam/, workspace/, dashboard/, copilot/
  charts/  hooks/  layouts/  lib/  services/ (API client + demo/)  store/  types/
ml/                 offline training, evaluation and dataset export for the PD model
demo/documents/     generated demo document packs   ·   test-docs/  sample upload packs
docs/               architecture, API, deployment and workflow guides
```

## Development

```bash
# backend (from backend/)
pip install -r requirements-dev.txt
ruff check .
pytest                       # 63 tests incl. upload -> ingest -> analyse -> CAM end to end
alembic upgrade head         # production schema; dev/test auto-create tables
python -m database.seed --reset

# frontend (from frontend/)
npm run lint && npm run typecheck && npm test && npm run build
```

Configuration lives in `backend/.env.example` (every value has a working local default) and
`frontend/.env.example`. CI (`.github/workflows/ci.yml`) runs lint, migrations, tests, the web build
and both Docker images.

## Documentation

* [Architecture overview](docs/architecture/overview.md) · [Scoring methodology](docs/architecture/scoring-methodology.md)
* [Underwriting lifecycle](docs/workflows/underwriting-lifecycle.md) · [API guide](docs/api/README.md)
* [Local stack](docs/deployment/local-stack.md) · [Production deployment](docs/deployment/production.md)
* [ML workspace](ml/README.md)

All demo companies, people, filings and news are fictional.
