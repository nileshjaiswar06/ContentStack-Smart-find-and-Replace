# NER Service Configuration

## Environment Variables

### Node.js Server (server/.env)

```bash
# Core Configuration
SERVER_PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_READS=200
RATE_LIMIT_MAX_WRITES=60
NER_RATE_LIMIT_WINDOW_MS=60000
NER_RATE_LIMIT_MAX=30

# NER Service Integration
ENABLE_NER=true
SPACY_SERVICE_URL=http://localhost:8000
SPACY_API_KEY=your_secret_key_here

# NER Proxy Configuration
USE_FAKE_NER=false
NER_TIMEOUT_MS=10000
NER_RETRY_COUNT=3

# Circuit Breaker Settings
NER_CIRCUIT_BREAKER_FAILURES=5
NER_CIRCUIT_BREAKER_TIMEOUT=30000
NER_CIRCUIT_BREAKER_SUCCESS=3

# Contentstack Configuration
CONTENTSTACK_API_KEY=your_api_key
CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token
CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token
CONTENTSTACK_ENVIRONMENT=your_environment
```

### spaCy Service (spacy-service/.env)

```bash
# Security
SPACY_API_KEY=your_secret_key_here

# CORS Configuration
SPACY_ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001

# Model Configuration (Docker build args)
INSTALL_TRF=false  # Set to true for transformer models (requires more RAM)
```

## Production Deployment

### 1. Security Hardening

```bash
# Use production Docker compose
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build

# Set strong API keys
SPACY_API_KEY=$(openssl rand -hex 32)

# Use internal network only (see docker-compose.prod.yml)
SPACY_SERVICE_URL=http://spacy-ner:8000
```

### 2. Monitoring & Observability

```bash
# Prometheus metrics available at:
curl http://localhost:8000/metrics

# Health checks:
curl http://localhost:3001/health
curl http://localhost:3001/api/ner/health
curl http://localhost:8000/health
```

### 3. Performance Tuning

```bash
# For high accuracy (requires more RAM):
INSTALL_TRF=true

# For high throughput:
NER_RATE_LIMIT_MAX=100
NER_TIMEOUT_MS=5000

# Circuit breaker tuning:
NER_CIRCUIT_BREAKER_FAILURES=3    # Fail faster
NER_CIRCUIT_BREAKER_TIMEOUT=60000 # Longer recovery
```

## Testing

```bash
# Smoke test (basic functionality)
# Use the Node API health endpoint or a manual curl against `/api/ner/health`

# Manual test endpoints
curl -X POST http://localhost:3001/api/ner \
  -H "Content-Type: application/json" \
  -d '{"text": "Alice went to Paris"}'

curl -X POST http://localhost:3001/api/ner/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Alice went to Paris", "Bob works at Microsoft"]}'
```

## Troubleshooting

### Common Issues

1. **spaCy model not found**
   ```bash
   # Download required models
   docker exec -it spacy-ner python -m spacy download en_core_web_sm
   ```

2. **Connection refused**
   ```bash
   # Check if services are running
   docker ps
   curl http://localhost:8000/health
   ```

3. **Rate limiting too strict**
   ```bash
   # Increase limits in .env
   NER_RATE_LIMIT_MAX=100
   ```

4. **Circuit breaker open**
   ```bash
   # Check spaCy service health
   curl http://localhost:3001/api/ner/health
   
   # Use mock mode temporarily
   USE_FAKE_NER=true
   ```

### Development Mode

```bash
# Use fake NER (no Docker required)
USE_FAKE_NER=true npm run dev

# Enable debug logging
DEBUG=ner:* npm run dev

# Hot reload spaCy service
docker compose up --build --watch
```
