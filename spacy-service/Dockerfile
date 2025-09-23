FROM python:3.9-slim

WORKDIR /app

# Build argument to control TRF model installation
ARG INSTALL_TRF=false

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Conditionally install TRF model if INSTALL_TRF is true
RUN if [ "$INSTALL_TRF" = "true" ]; then \
        echo "Installing en_core_web_trf model..." && \
        python -m spacy download en_core_web_trf; \
    else \
        echo "Skipping en_core_web_trf model installation"; \
    fi

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start the application
CMD ["python", "app.py"]