FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# spaCy models are installed via requirements.txt
ARG INSTALL_TRF=false
ARG TRF_VERSION=3.7.1
# Install transformer model wheel explicitly when requested. Using the wheel
# URL is more reliable in non-interactive/container builds than
# `python -m spacy download` which may attempt to infer an unstable URL.
RUN if [ "$INSTALL_TRF" = "true" ]; then \
            pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_trf-${TRF_VERSION}/en_core_web_trf-${TRF_VERSION}-py3-none-any.whl ; \
        fi

# Copy application code
COPY app.py .

# Copy custom entity ruler and pattern files
COPY entity_ruler.py .
COPY brand_product_patterns.json .
# training_data.json is optional - only copy if it exists
COPY training_data.json* ./

# Expose port
EXPOSE 8000

# Run as non-root user
RUN useradd -m spacyuser || true
# Make sure the application directory is owned by the runtime user to reduce
# permission errors when not mounting host files. If you mount a host file, you
# may still need to adjust ownership on the host or run the container without
# the user switch for development.
RUN chown -R spacyuser:spacyuser /app || true
USER spacyuser

# Health check (container must have curl; base image includes it)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]

# NOTE: It's recommended to pin Python dependency versions (requirements.txt is
# present). For reproducible builds consider adding a lockfile (pip-tools, poetry
# lock, or a generated requirements.lock via `pip freeze > requirements.lock`).