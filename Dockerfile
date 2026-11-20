FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir ".[postgres]" && useradd --create-home corella
USER corella

EXPOSE 8000
# Default: API server. The worker uses the same image with: corella worker
# Hosts like Render pass the port in $PORT
CMD ["sh", "-c", "exec uvicorn corella.api:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
