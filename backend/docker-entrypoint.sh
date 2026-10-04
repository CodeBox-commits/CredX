#!/bin/sh
# Container entrypoint: `api` (default) runs migrations then serves; `worker` runs Celery;
# `seed` loads the demo portfolio; anything else is executed as-is.
set -e

case "$1" in
  api)
    if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
      alembic upgrade head
    fi
    if [ "${SEED_DEMO:-false}" = "true" ]; then
      python -m database.seed
    fi
    exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*" \
      --workers "${WEB_CONCURRENCY:-2}"
    ;;
  worker)
    exec celery -A workers.celery_app worker --loglevel="${LOG_LEVEL:-INFO}" --concurrency="${WORKER_CONCURRENCY:-2}"
    ;;
  seed)
    alembic upgrade head
    exec python -m database.seed
    ;;
  *)
    exec "$@"
    ;;
esac
