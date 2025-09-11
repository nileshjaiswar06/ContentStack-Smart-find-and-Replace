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

# Download small spaCy model by default; transformer model optional via build arg
ARG INSTALL_TRF=false
RUN python -m spacy download en_core_web_sm
RUN if [ "$INSTALL_TRF" = "true" ]; then python -m spacy download en_core_web_trf; fi

# Copy application code
COPY app.py .

# Expose port
EXPOSE 8000

# Run as non-root user
RUN useradd -m spacyuser || true
USER spacyuser

# Health check (container must have curl; base image includes it)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]