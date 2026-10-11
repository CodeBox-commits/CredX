# CredX API / worker image.  Build context: backend/
#   docker build -t credx-api backend
#   docker run -p 8000:8000 --env-file backend/.env credx-api            # API
#   docker run --env-file backend/.env credx-api worker                  # Celery worker
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# tesseract: OCR for scanned pages; libgl/libglib: OpenCV runtime used by Camelot.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 10001 credx \
    && mkdir -p /app/storage \
    && chown -R credx:credx /app
USER credx

ENV STORAGE_DIR=/app/storage \
    PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["api"]
