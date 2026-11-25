FROM python:3.12-slim AS runtime
WORKDIR /srv
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/*.py ./
COPY apps/backend/migrations/ migrations/
COPY packages/contracts/openapi.yaml .
RUN useradd --create-home app
USER app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM runtime AS test
USER root
ENV RUFF_CACHE_DIR=/tmp/ruff PYTEST_ADDOPTS="-p no:cacheprovider"
COPY apps/backend/requirements-test.txt .
RUN pip install --no-cache-dir -r requirements-test.txt
COPY apps/backend/tests/ tests/
USER app
