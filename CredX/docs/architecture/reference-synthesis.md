# CredX Architecture Synthesis

CredX Phase 1 intentionally merges the best ideas from the reference repositories while simplifying their rough edges into one deployable platform foundation.

## What We Kept

### Intelli_credit_platform
- End-to-end underwriting workflow coverage across ingestion, research, scoring, graph, CAM, and copilot.
- Clear API-oriented thinking for multi-step analysis pipelines.
- Docker-first mindset for local platform bring-up.

### Slice-Credit-Scoring-Engine
- Transparent scorecard discipline instead of an opaque approval output.
- Feature engineering and score band logic inspired by explainable retail/fintech credit engines.
- Explicit separation between prediction, score translation, and monitoring-style metadata.

### CreditMind
- India-specific underwriting heuristics such as GSTR consistency, DSCR-style framing, and document confidence penalties.
- Rule-based score adjustments that are easy for an analyst or committee to understand.
- CAM generation tied directly to the same evidence stack used in scoring.

### CogniCam
- GST fraud heuristics for mismatch, turnover inflation, and circular-trading suspicion.
- Five Cs framing as a lender-friendly mental model.
- Demo-oriented clarity: progress-friendly UX, explainability, and professional report outputs.

## What We Changed

- Replaced the many-service reference architecture with one modular FastAPI backend so the platform is easier to deploy, test, and iterate.
- Preserved the strongest underwriting UX direction from the current CredX frontend while introducing a cleaner `frontend/` application boundary.
- Kept explainability first-class: structured extraction, factor traces, Five Cs scores, and pricing rationale all flow through the same response model.
- Designed fraud graph logic to be `NetworkX`/JSON friendly now while staying Neo4j-ready later.
- Kept AI provider orchestration modular without forcing an LLM dependency into the core scoring path.

## Current Phase 1 State

- `frontend/` now contains the React application source.
- `backend/app/api` exposes coherent routes for uploads, research, fraud, underwriting, CAM, and copilot.
- `backend/app/extraction`, `scoring`, `research`, `fraud`, `cam`, and `ai` provide domain modules that can grow phase by phase.
- Docker, CI, env templates, and backend tests are included so the repo is moving toward realistic deployment instead of demo-only structure.
