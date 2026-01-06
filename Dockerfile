FROM python:3.11-slim

WORKDIR /app

# Install git for repository scanning
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Configure git to trust mounted repositories
RUN git config --global --add safe.directory '*'

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 4000

# Optimized sync workers with threads for I/O
# - workers 1: single process (low memory for portfolio site)
# - threads 4: handle concurrent requests without blocking
# - timeout 120: keep existing timeout for slow git operations
CMD ["gunicorn", "--bind", "0.0.0.0:4000", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
