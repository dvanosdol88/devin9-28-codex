FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/python

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install deps first for better caching
COPY python/requirements.txt ./python/requirements.txt
RUN pip install --upgrade pip && pip install -r python/requirements.txt

# App code
COPY . .

# Non-root
RUN useradd -m app && chown -R app:app /app
USER app

EXPOSE 8001

# Healthcheck hits Falcon /health
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://localhost:8001/health || exit 1

# Write certs if provided, then start server; fall back to pytest if no start script
CMD bash -lc '[[ -x ./scripts/write_certs.sh ]] && ./scripts/write_certs.sh || true; \
              [[ -x ./scripts/start_api.sh ]] && ./scripts/start_api.sh || python -m pytest -q'
