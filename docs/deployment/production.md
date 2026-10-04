# Production deployment

Target topology (all managed, free/low tiers available):

| Component | Service | Notes |
|---|---|---|
| Web (Next.js) | **Vercel** | Root directory `frontend/`. Set `BACKEND_URL` to the API's public URL — `/api/v1/*` is proxied same-origin. |
| API | **Railway** or **Render** | `backend/Dockerfile`, command `/app/docker-entrypoint.sh api` (runs `alembic upgrade head`, then uvicorn). `backend/railway.json` / `render.yaml` included. |
| Worker | Railway/Render background worker | Same image, command `/app/docker-entrypoint.sh worker` (Celery). |
| Database | **Supabase Postgres** | Use the pooled connection string (port 6543) as `DATABASE_URL`; `postgres://` URLs are normalised automatically. |
| Queue/cache | **Upstash Redis** | `REDIS_URL=rediss://default:<token>@<host>:6379` — Celery broker + research cache. |
| Files | **S3** (or R2 / Supabase Storage, S3 API) | `STORAGE_BACKEND=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT_URL`. Objects are written with SSE-AES256. |

### Steps

1. **Supabase** → create project → copy the pooled connection string.
2. **Upstash** → create Redis database → copy the `rediss://` URL.
3. **Railway** → New service from repo, root `backend/` (uses `railway.json`). Add a second service from
   the same repo with start command `/app/docker-entrypoint.sh worker`. Set the variables from
   `.env.example` (at minimum `ENVIRONMENT=production`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`,
   `JOB_BACKEND=celery`, `AUTO_CREATE_TABLES=false`, storage settings). Optional: `SEED_DEMO=true` for a demo environment.
   *Render alternative:* `render.yaml` blueprint (API + worker + shared env group).
4. **Vercel** → import repo, root `frontend/`, env `BACKEND_URL=https://<your-api>`. Deploy.
5. Sign up on the web app — the first account becomes **admin**; then set `ALLOW_SELF_SIGNUP=false`
   and invite the team from *Governance → Users*.

### Single-container budget mode

Skip Redis and the worker: set `JOB_BACKEND=thread`. Jobs run inside the API process (PDF parsing is
serialised for thread safety). Fine for demos and low volume; use Celery for production throughput.

## Security checklist

- [x] `JWT_SECRET` required in production (startup fails on the default); bcrypt password hashing.
- [x] Role-based access on every route; maker–checker on overrides; append-only audit log with request ids.
- [x] Upload hardening: extension allow-list, magic-byte sniffing, size cap, PDF active-content rejection, SHA-256 de-duplication, sanitised filenames, storage keys never derived from user input.
- [x] Login/registration rate limiting; uniform error envelope (no stack traces leak).
- [x] Security headers (nosniff, frame-deny, referrer & permissions policy) on API and web.
- [x] Containers run as non-root; secrets only via environment.
- [ ] Put a WAF / Cloudflare in front and move the in-memory login limiter to Redis for multi-replica APIs.
- [ ] Enable Postgres PITR backups and S3 versioning per your data-retention policy.

## Observability

* **Logs** — `LOG_JSON=true` emits structured JSON with `request_id` / `job_id` correlation.
* **Metrics** — Prometheus at `/metrics`: request rate/latency by route, job counts/durations by kind,
  documents processed by type, LLM tokens by provider. Point Grafana at it.
* **Errors** — set `SENTRY_DSN` and `pip install sentry-sdk`; initialised automatically at startup.
* **Health** — `/health` (liveness) and `/health/ready` (DB, job backend, OCR availability, active AI providers).
* **AI spend** — every LLM call is recorded in `ai_usage` (provider, model, tokens, latency, success) and
  summarised on the dashboard.
