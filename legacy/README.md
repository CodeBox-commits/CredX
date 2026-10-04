# Legacy code (safe to delete)

Everything here is the pre-rewrite CredX code, relocated (not deleted) during the platform rebuild so
the repository root matches the new architecture. Nothing in `frontend/`, `backend/`, `ml/` or the
deployment config imports from this folder.

| Folder | What it was | Replaced by |
|---|---|---|
| `vite-frontend-src/` | Vite + React Router SPA (`frontend/src`) | `frontend/` (Next.js App Router) |
| `root-vite-config/` | Root `package.json`, Vite/Vitest/Tailwind/ESLint/TS configs, bun & npm lockfiles | `frontend/*.config.*`, root task-runner `package.json` |
| `duplicate-trees/src`, `duplicate-trees/core` | Older copies of the SPA pages and a PDF parser | `frontend/`, `backend/extraction/` |
| `duplicate-trees/CredX` | A full nested copy of an earlier checkout | — |
| `duplicate-trees/backend-app` | Heuristic FastAPI prototype (`backend/app`) | `backend/` (api, extraction, scoring, research, fraud, cam, ai, workers) |

The originals are all in git history. To remove this folder once you're happy:

```bash
git rm -r legacy
```
