"""
spaCy NER Microservice for Contentstack Find & Replace
High-performance Named Entity Recognition with confidence scores and entity spans
"""

import spacy
import uvicorn
import os
import logging
import time
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global storage for models and custom entity rulers
models = {}
custom_rulers = {}

# Request correlation ID storage
request_id_context: ContextVar[str] = ContextVar('request_id', default=None)

def log_with_request_id(level: str, message: str, **kwargs):
    """Helper function to include request ID in log messages when available"""
    request_id = request_id_context.get()
    if request_id:
        message = f"[req_id={request_id}] {message}"
    
    log_func = getattr(logger, level.lower(), logger.info)
    log_func(message, **kwargs)

# Prometheus metrics setup
request_count = Counter('spacy_requests_total', 'Total NER requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('spacy_request_duration_seconds', 'Request duration', ['method', 'endpoint'])
entities_extracted = Counter('spacy_entities_extracted_total', 'Total entities extracted', ['model', 'label'])
text_length_processed = Histogram('spacy_text_length_chars', 'Length of processed text', ['model'])
active_requests = Gauge('spacy_active_requests', 'Currently active requests')
model_load_time = Gauge('spacy_model_load_time_seconds', 'Time taken to load models', ['model'])

# Circuit breaker metrics - updated by Node service via /metrics/report
circuit_breaker_failures_count = Gauge('spacy_circuit_breaker_failures_count', 'Circuit breaker failures (current count)')
circuit_breaker_open = Gauge('spacy_circuit_breaker_open', 'Circuit breaker open state (1=open, 0=closed)')
circuit_breaker_pending = Gauge('spacy_circuit_breaker_pending', 'Circuit breaker pending request count')

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown handler"""
    logger.info("Loading spaCy models...")
    
    # Load fast model (en_core_web_sm)
    try:
        start_time = time.time()
        models['en_core_web_sm'] = spacy.load("en_core_web_sm")
        load_time = time.time() - start_time
        model_load_time.labels(model='en_core_web_sm').set(load_time)
        logger.info(f"Loaded en_core_web_sm (fast) in {load_time:.2f}s")
    except OSError:
        logger.warning("en_core_web_sm not found. Install with: python -m spacy download en_core_web_sm")
        models['en_core_web_sm'] = None
    
    # Load transformer model (en_core_web_trf)
    try:
        start_time = time.time()
        models['en_core_web_trf'] = spacy.load("en_core_web_trf")
        load_time = time.time() - start_time
        model_load_time.labels(model='en_core_web_trf').set(load_time)
        logger.info(f"Loaded en_core_web_trf (accurate) in {load_time:.2f}s")
    except OSError:
        logger.warning("en_core_web_trf not found. Install with: python -m spacy download en_core_web_trf")
        models['en_core_web_trf'] = None
    
    if not any(models.values()):
        raise RuntimeError("No spaCy models available. Install at least one model.")
    
    # Initialize custom entity rulers
    try:
        from entity_ruler import BrandProductEntityRuler
        
        for model_name, nlp in models.items():
            if nlp is not None:
                custom_rulers[model_name] = BrandProductEntityRuler(nlp, model_name)
                logger.info(f"Initialized custom entity ruler for {model_name}")
        
        # Load training data if present
        if os.path.exists("training_data.json"):
            for ruler in custom_rulers.values():
                ruler.load_training_data("training_data.json")
            logger.info("Loaded custom training data")
            
    except ImportError as e:
        logger.warning(f"Could not import custom entity ruler: {e}")
    except Exception as e:
        logger.warning(f"Could not initialize custom entity rulers: {e}")
    
    logger.info("spaCy service ready!")
    yield
    
    # Cleanup on shutdown
    models.clear()
    custom_rulers.clear()
    logger.info("spaCy service shutdown complete")

# Create FastAPI application
app = FastAPI(
    title="spaCy NER Service",
    description="High-performance Named Entity Recognition for Contentstack Find & Replace",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware: Request ID correlation for logging
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Extract and store request ID for logging correlation"""
    request_id = request.headers.get("x-request-id")
    if request_id:
        request_id_context.set(request_id)
        request.state.request_id = request_id
    
    response = await call_next(request)
    
    # Echo request ID back in response headers
    if request_id:
        response.headers["x-request-id"] = request_id
    
    return response

# Middleware: Prometheus metrics collection
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Collect request metrics for monitoring"""
    start_time = time.time()
    active_requests.inc()
    
    endpoint = request.url.path
    method = request.method
    
    try:
        response = await call_next(request)
        status = str(response.status_code)
        
        request_count.labels(method=method, endpoint=endpoint, status=status).inc()
        request_duration.labels(method=method, endpoint=endpoint).observe(time.time() - start_time)
        
        return response
    except Exception as e:
        request_count.labels(method=method, endpoint=endpoint, status="500").inc()
        request_duration.labels(method=method, endpoint=endpoint).observe(time.time() - start_time)
        raise
    finally:
        active_requests.dec()

# Configure CORS
allowed = []
try:
    from dotenv import load_dotenv
    load_dotenv()
    allowed = [o.strip() for o in (os.getenv("SPACY_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")).split(",") if o.strip()]
except Exception:
    allowed = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Optional API key authentication
try:
    SPACY_API_KEY = os.getenv("SPACY_API_KEY")
except Exception:
    SPACY_API_KEY = None

# Middleware: API key validation
@app.middleware("http")
async def api_key_middleware(request, call_next):
    """Simple API key authentication for internal services"""
    if not SPACY_API_KEY:
        return await call_next(request)

    # Allow health check and labels endpoint without authentication
    if request.url.path in ("/health", "/labels"):
        return await call_next(request)

    key = request.headers.get("x-api-key")
    if key != SPACY_API_KEY:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})

    return await call_next(request)


# Pydantic models for request/response validation
class Entity(BaseModel):
    text: str = Field(..., description="The entity text")
    label: str = Field(..., description="Entity label (PERSON, ORG, GPE, etc.)")
    start: int = Field(..., description="Start character position")
    end: int = Field(..., description="End character position")
    confidence: float = Field(..., description="Confidence score (0-1)")

class NERRequest(BaseModel):
    text: str = Field(..., description="Text to analyze", min_length=1, max_length=100000)
    model: str = Field("en_core_web_trf", description="Model to use (en_core_web_sm or en_core_web_trf)")
    min_confidence: float = Field(0.5, description="Minimum confidence threshold", ge=0.0, le=1.0)
    labels: Optional[List[str]] = Field(None, description="Filter specific entity labels")

class NERResponse(BaseModel):
    entities: List[Entity]
    model_used: str
    processing_time_ms: float
    text_length: int
    entity_count: int

class BatchNERRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to analyze", max_items=100)
    model: str = Field("en_core_web_trf", description="Model to use")
    min_confidence: float = Field(0.5, description="Minimum confidence threshold")
    labels: Optional[List[str]] = Field(None, description="Filter specific entity labels")

class BatchNERResponse(BaseModel):
    results: List[NERResponse]
    total_processing_time_ms: float
    batch_size: int

# Health check endpoint
@app.get("/health")
async def health_check():
    """Check service health and list available models"""
    available_models = [name for name, model in models.items() if model is not None]
    return {
        "status": "healthy",
        "available_models": available_models,
        "timestamp": time.time()
    }

# Prometheus metrics endpoint
@app.get("/metrics", response_class=PlainTextResponse)
async def get_metrics():
    """Export Prometheus metrics"""
    return generate_latest()

# Main NER endpoint with auto model selection
@app.post("/ner", response_model=NERResponse)
async def extract_entities(request: NERRequest):
    """
    Extract named entities from text with confidence scores and spans.
    
    Supports 'auto' model mode which runs fast model first (en_core_web_sm) 
    and escalates to transformer (en_core_web_trf) based on heuristics like 
    text length, entity confidence, and complexity.
    """
    start_time = time.time()

    def calculate_entity_confidence(entity_text: str) -> float:
        """Calculate confidence score based on entity text length"""
        return min(1.0, max(0.0, len(entity_text) / 10.0))

    def process_with_model(model_name: str):
        """Run NLP processing with specified model and collect entities"""
        nlp = models.get(model_name)
        if nlp is None:
            return []
        
        doc = nlp(request.text)
        collected_entities = []

        # Process standard spaCy entities
        for entity in doc.ents:
            confidence = calculate_entity_confidence(entity.text)
            if confidence < request.min_confidence:
                continue
            if request.labels and entity.label_ not in request.labels:
                continue
            
            entities_extracted.labels(model=model_name, label=entity.label_).inc()
            collected_entities.append({
                'text': entity.text,
                'label': entity.label_,
                'start': entity.start_char,
                'end': entity.end_char,
                'confidence': confidence,
                'source': model_name
            })

        # Process custom entity ruler results
        try:
            if model_name in custom_rulers:
                custom_entities = custom_rulers[model_name].process_text(request.text)
                for custom_entity in custom_entities:
                    if custom_entity['confidence'] < request.min_confidence:
                        continue
                    if request.labels and custom_entity['label'] not in request.labels:
                        continue
                    entities_extracted.labels(model=model_name, label=custom_entity['label']).inc()
                    collected_entities.append(custom_entity)
        except Exception as e:
            log_with_request_id("warning", f"Custom ruler failed for {model_name}: {e}")

        return collected_entities

    # Model selection logic
    requested_model_raw = request.model
    requested_model = (requested_model_raw or 'auto').strip()
    requested_model_lower = requested_model.lower()

    if requested_model_lower == 'auto':
        requested_model = 'auto'
        requested_model_lower = 'auto'

    available_models = [k for k, v in models.items() if v is not None]

    if requested_model_lower != 'auto' and requested_model not in available_models:
        raise HTTPException(status_code=400, detail=f"Model '{requested_model}' not available. Available: {available_models}")

    try:
        if requested_model_lower == 'auto':
            # Auto model selection with escalation logic
            use_sm = 'en_core_web_sm' in available_models
            use_trf = 'en_core_web_trf' in available_models

            entities_final = []
            model_used = None

            if use_sm:
                # Try fast model first
                sm_entities = process_with_model('en_core_web_sm')
                avg_conf = (sum(e['confidence'] for e in sm_entities) / len(sm_entities)) if sm_entities else 1.0
                low_conf_exists = any(e['confidence'] < float(os.getenv('NER_TRF_ESCALATE_SPAN_CONF', '0.5')) for e in sm_entities)

                # Decide whether to escalate to TRF
                escalate = False
                if use_trf:
                    if len(request.text) >= int(os.getenv('NER_TRF_MIN_CHARS', '500')):
                        escalate = True
                    if avg_conf < float(os.getenv('NER_TRF_AVG_CONF', '0.65')):
                        escalate = True
                    if low_conf_exists:
                        escalate = True

                if escalate:
                    # Use TRF for better accuracy
                    trf_entities = process_with_model('en_core_web_trf') if use_trf else sm_entities
                    entities_final = trf_entities
                    model_used = 'en_core_web_trf' if use_trf else 'en_core_web_sm'
                else:
                    entities_final = sm_entities
                    model_used = 'en_core_web_sm'

            else:
                # Fallback to TRF if no SM available
                if 'en_core_web_trf' in available_models:
                    entities_final = process_with_model('en_core_web_trf')
                    model_used = 'en_core_web_trf'
                else:
                    raise HTTPException(status_code=500, detail='No spaCy models available')

        else:
            # Use explicitly requested model
            entities_final = process_with_model(requested_model)
            model_used = requested_model

        # Deduplicate entities - keep highest confidence for same span
        entity_map = {}
        for entity in entities_final:
            key = (entity['text'], entity['start'], entity['end'])
            if key not in entity_map or entity['confidence'] > entity_map[key]['confidence']:
                entity_map[key] = entity

        entities_out = [
            Entity(
                text=entity_data['text'], 
                label=entity_data['label'], 
                start=entity_data['start'], 
                end=entity_data['end'], 
                confidence=round(entity_data['confidence'], 3)
            ) 
            for entity_data in entity_map.values()
        ]

        # Record metrics
        text_length_processed.labels(model=model_used).observe(len(request.text))
        processing_time = (time.time() - start_time) * 1000

        return NERResponse(
            entities=entities_out,
            model_used=model_used,
            processing_time_ms=round(processing_time, 2),
            text_length=len(request.text),
            entity_count=len(entities_out)
        )

    except Exception as e:
        log_with_request_id("error", f"Error processing text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")

# Batch processing endpoint
@app.post("/ner/batch", response_model=BatchNERResponse)
async def extract_entities_batch(request: BatchNERRequest):
    """Process multiple texts efficiently using spaCy's batch processing"""
    start_time = time.time()
    
    # Validate requested model
    if request.model not in models or models[request.model] is None:
        raise HTTPException(
            status_code=400, 
            detail=f"Model '{request.model}' not available. Available: {list(models.keys())}"
        )
    
    nlp = models[request.model]
    results = []
    
    try:
        log_with_request_id("debug", f"Processing batch with model={request.model} batch_size={len(request.texts)}")
        
        # Use spaCy's efficient batch processing
        docs = list(nlp.pipe(request.texts))
        
        for i, doc in enumerate(docs):
            entities = []
            for ent in doc.ents:
                confidence = min(1.0, len(ent.text) / 10.0)
                
                if confidence < request.min_confidence:
                    continue
                
                if request.labels and ent.label_ not in request.labels:
                    continue
                
                entities_extracted.labels(model=request.model, label=ent.label_).inc()
                
                entities.append(Entity(
                    text=ent.text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                    confidence=confidence
                ))
            
            text_length_processed.labels(model=request.model).observe(len(request.texts[i]))
            
            results.append(NERResponse(
                entities=entities,
                model_used=request.model,
                processing_time_ms=0,  # Calculated as total batch time
                text_length=len(request.texts[i]),
                entity_count=len(entities)
            ))
        
        total_processing_time = (time.time() - start_time) * 1000
        
        return BatchNERResponse(
            results=results,
            total_processing_time_ms=round(total_processing_time, 2),
            batch_size=len(request.texts)
        )
        
    except Exception as e:
        log_with_request_id("error", f"Error processing batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing batch: {str(e)}")

# Entity labels information endpoint
@app.get("/labels")
async def get_entity_labels():
    """Get available entity labels and their descriptions"""
    labels = set()
    for model_name, model in models.items():
        if model is not None:
            labels.update(model.get_pipe("ner").labels)
    
    return {
        "labels": sorted(list(labels)),
        "description": {
            "PERSON": "People, including fictional",
            "ORG": "Companies, agencies, institutions",
            "GPE": "Countries, cities, states",
            "LOC": "Non-GPE locations, mountain ranges, bodies of water",
            "PRODUCT": "Objects, vehicles, foods, etc.",
            "EVENT": "Named hurricanes, battles, wars, sports events",
            "WORK_OF_ART": "Titles of books, songs, etc.",
            "LAW": "Named documents made into laws",
            "LANGUAGE": "Any named language",
            "DATE": "Absolute or relative dates or periods",
            "TIME": "Times smaller than a day",
            "PERCENT": "Percentage",
            "MONEY": "Monetary values",
            "QUANTITY": "Measurements, counts",
            "ORDINAL": "First, second, etc.",
            "CARDINAL": "Numerals that don't fall under another type"
        }
    }

# Circuit breaker metrics reporting endpoint
@app.post('/metrics/report')
async def metrics_report(payload: Dict[str, Any], request: Request):
    """
    Accept circuit breaker state reports from the Node.js gateway service.
    Updates Prometheus gauges so /metrics endpoint exposes circuit breaker state.
    
    Expected payload: {
        "event": "open|close|state", 
        "state": {"open": bool, "pending": int, "stats": {...}}, 
        "timestamp": 123456789
    }
    """
    try:
        event = payload.get('event') if isinstance(payload, dict) else None
        state = payload.get('state') if isinstance(payload, dict) else None
        request_id = payload.get('requestId') or payload.get('request_id') if isinstance(payload, dict) else None

        log_with_request_id("debug", f"Received metrics report event={event}")

        if isinstance(state, dict):
            # Update circuit breaker open/closed state
            if 'open' in state:
                try:
                    circuit_breaker_open.set(1 if state.get('open') else 0)
                except Exception:
                    pass

            # Update pending request count
            if 'pending' in state:
                try:
                    circuit_breaker_pending.set(int(state.get('pending') or 0))
                except Exception:
                    pass

            # Update failure count from stats
            stats = state.get('stats') or {}
            if isinstance(stats, dict):
                failures = stats.get('failures') or stats.get('failureCount') or stats.get('failure_count') or stats.get('failure')
                if failures is not None:
                    try:
                        circuit_breaker_failures_count.set(float(failures))
                    except Exception:
                        pass

            # Log detailed info for correlation if request_id provided
            if request_id:
                try:
                    log_with_request_id("info", f"metrics_report: event={event} open={state.get('open') if isinstance(state, dict) else 'n/a'} pending={state.get('pending') if isinstance(state, dict) else 'n/a'}")
                except Exception:
                    log_with_request_id("debug", "metrics_report: failed to log detailed info")

        return {"ok": True}
    except Exception as e:
        log_with_request_id("warning", f"Failed to process metrics report: {e}")
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )