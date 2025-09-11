"""
spaCy NER Microservice for Contentstack Find & Replace
High-performance Named Entity Recognition with confidence scores and entity spans
"""

import spacy
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
import time
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model storage
models = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup"""
    logger.info("Loading spaCy models...")
    
    # Load both speed and accuracy models
    try:
        models['en_core_web_sm'] = spacy.load("en_core_web_sm")
        logger.info("✓ Loaded en_core_web_sm (fast)")
    except OSError:
        logger.warning("en_core_web_sm not found. Install with: python -m spacy download en_core_web_sm")
        models['en_core_web_sm'] = None
    
    try:
        models['en_core_web_trf'] = spacy.load("en_core_web_trf")
        logger.info("✓ Loaded en_core_web_trf (accurate)")
    except OSError:
        logger.warning("en_core_web_trf not found. Install with: python -m spacy download en_core_web_trf")
        models['en_core_web_trf'] = None
    
    if not any(models.values()):
        raise RuntimeError("No spaCy models available. Install at least one model.")
    
    logger.info("spaCy service ready!")
    yield
    
    # Cleanup on shutdown
    models.clear()
    logger.info("spaCy service shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="spaCy NER Service",
    description="High-performance Named Entity Recognition for Contentstack Find & Replace",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for local development and configured origins
allowed = []
try:
    from dotenv import load_dotenv
    load_dotenv()
    import os
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


# Optional simple API key auth for internal services
try:
    import os
    SPACY_API_KEY = os.getenv("SPACY_API_KEY")
except Exception:
    SPACY_API_KEY = None


@app.middleware("http")
async def api_key_middleware(request, call_next):
    # If no key configured, allow all requests
    if not SPACY_API_KEY:
        return await call_next(request)

    # Allow health and labels without key for basic checks
    if request.url.path in ("/health", "/labels"):
        return await call_next(request)

    key = request.headers.get("x-api-key")
    if key != SPACY_API_KEY:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key"})

    return await call_next(request)


# Pydantic models
class Entity(BaseModel):
    text: str = Field(..., description="The entity text")
    label: str = Field(..., description="Entity label (PERSON, ORG, GPE, etc.)")
    start: int = Field(..., description="Start character position")
    end: int = Field(..., description="End character position")
    confidence: float = Field(..., description="Confidence score (0-1)")

class NERRequest(BaseModel):
    text: str = Field(..., description="Text to analyze", min_length=1, max_length=100000)
    model: str = Field("en_core_web_sm", description="Model to use (en_core_web_sm or en_core_web_trf)")
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
    model: str = Field("en_core_web_sm", description="Model to use")
    min_confidence: float = Field(0.5, description="Minimum confidence threshold")
    labels: Optional[List[str]] = Field(None, description="Filter specific entity labels")

class BatchNERResponse(BaseModel):
    results: List[NERResponse]
    total_processing_time_ms: float
    batch_size: int

# Health check endpoint
@app.get("/health")
async def health_check():
    """Service health check"""
    available_models = [name for name, model in models.items() if model is not None]
    return {
        "status": "healthy",
        "available_models": available_models,
        "timestamp": time.time()
    }

# Single text NER endpoint
@app.post("/ner", response_model=NERResponse)
async def extract_entities(request: NERRequest):
    """Extract named entities from text with confidence scores and spans"""
    start_time = time.time()
    
    # Validate model
    if request.model not in models or models[request.model] is None:
        raise HTTPException(
            status_code=400, 
            detail=f"Model '{request.model}' not available. Available: {list(models.keys())}"
        )
    
    nlp = models[request.model]
    
    try:
        # Process text
        doc = nlp(request.text)
        
        # Extract entities with confidence scores
        entities = []
        for ent in doc.ents:
            # Calculate confidence (spaCy doesn't provide this directly, so we use a heuristic)
            confidence = min(1.0, len(ent.text) / 10.0)  # Longer entities = higher confidence
            
            # Apply confidence filter
            if confidence < request.min_confidence:
                continue
            
            # Apply label filter
            if request.labels and ent.label_ not in request.labels:
                continue
            
            entities.append(Entity(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
                confidence=confidence
            ))
        
        processing_time = (time.time() - start_time) * 1000
        
        return NERResponse(
            entities=entities,
            model_used=request.model,
            processing_time_ms=round(processing_time, 2),
            text_length=len(request.text),
            entity_count=len(entities)
        )
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")

# Batch NER endpoint
@app.post("/ner/batch", response_model=BatchNERResponse)
async def extract_entities_batch(request: BatchNERRequest):
    """Extract named entities from multiple texts in batch"""
    start_time = time.time()
    
    # Validate model
    if request.model not in models or models[request.model] is None:
        raise HTTPException(
            status_code=400, 
            detail=f"Model '{request.model}' not available. Available: {list(models.keys())}"
        )
    
    nlp = models[request.model]
    results = []
    
    try:
        # Process texts in batch for efficiency
        docs = list(nlp.pipe(request.texts))
        
        for i, doc in enumerate(docs):
            entities = []
            for ent in doc.ents:
                confidence = min(1.0, len(ent.text) / 10.0)
                
                if confidence < request.min_confidence:
                    continue
                
                if request.labels and ent.label_ not in request.labels:
                    continue
                
                entities.append(Entity(
                    text=ent.text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                    confidence=confidence
                ))
            
            results.append(NERResponse(
                entities=entities,
                model_used=request.model,
                processing_time_ms=0,  # Will be calculated for total
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
        logger.error(f"Error processing batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing batch: {str(e)}")

# Entity labels endpoint
@app.get("/labels")
async def get_entity_labels():
    """Get available entity labels for the loaded models"""
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

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )