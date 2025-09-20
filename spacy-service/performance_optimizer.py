"""
Performance Optimization for NER Service
Implements caching, batching, and resource optimization
"""

import time
import hashlib
from typing import Dict, List, Any, Optional
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class NERCache:
    """Simple in-memory cache for NER results"""
    
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_size = max_size
        self.ttl = ttl
        self.access_times: Dict[str, float] = {}
    
    def _generate_key(self, text: str, model: str, min_confidence: float, labels: Optional[List[str]]) -> str:
        """Generate cache key for request"""
        key_data = f"{text}:{model}:{min_confidence}:{sorted(labels or [])}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, text: str, model: str, min_confidence: float, labels: Optional[List[str]]) -> Optional[Dict[str, Any]]:
        """Get cached result"""
        key = self._generate_key(text, model, min_confidence, labels)
        
        if key in self.cache:
            # Check TTL
            if time.time() - self.access_times[key] < self.ttl:
                self.access_times[key] = time.time()
                return self.cache[key]
            else:
                # Expired, remove
                del self.cache[key]
                del self.access_times[key]
        
        return None
    
    def set(self, text: str, model: str, min_confidence: float, labels: Optional[List[str]], result: Dict[str, Any]):
        """Cache result"""
        key = self._generate_key(text, model, min_confidence, labels)
        
        # Remove oldest if cache is full
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
            del self.cache[oldest_key]
            del self.access_times[oldest_key]
        
        self.cache[key] = result
        self.access_times[key] = time.time()
    
    def clear(self):
        """Clear cache"""
        self.cache.clear()
        self.access_times.clear()

class BatchProcessor:
    """Optimized batch processing for NER"""
    
    def __init__(self, nlp, batch_size: int = 32):
        self.nlp = nlp
        self.batch_size = batch_size
    
    def process_batch(self, texts: List[str]) -> List[Any]:
        """Process texts in optimized batches"""
        results = []
        
        # Process in batches for memory efficiency
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            
            # Use spaCy's pipe for efficient batch processing
            docs = list(self.nlp.pipe(batch, n_process=1))  # Single process for consistency
            results.extend(docs)
        
        return results

class ResourceMonitor:
    """Monitor and optimize resource usage"""
    
    def __init__(self):
        self.request_count = 0
        self.total_processing_time = 0
        self.memory_usage = 0
    
    def record_request(self, processing_time: float):
        """Record request metrics"""
        self.request_count += 1
        self.total_processing_time += processing_time
    
    def get_avg_processing_time(self) -> float:
        """Get average processing time"""
        return self.total_processing_time / max(1, self.request_count)
    
    def should_optimize(self) -> bool:
        """Determine if optimization is needed"""
        return self.get_avg_processing_time() > 2.0  # 2 seconds threshold

class ModelSelector:
    """Intelligent model selection based on text characteristics"""
    
    def __init__(self):
        self.fast_model = "en_core_web_sm"
        self.accurate_model = "en_core_web_trf"
    
    def select_model(self, text: str, accuracy_required: bool = False) -> str:
        """Select appropriate model based on text and requirements"""
        
        # Use fast model for short texts unless accuracy is required
        if len(text) < 200 and not accuracy_required:
            return self.fast_model
        
        # Use accurate model for complex texts or when accuracy is required
        if (len(text) > 500 or 
            any(keyword in text.lower() for keyword in ['brand', 'product', 'company', 'organization']) or
            accuracy_required):
            return self.accurate_model
        
        # Default to fast model
        return self.fast_model

class ConfidenceOptimizer:
    """Optimize confidence scoring for better accuracy"""
    
    @staticmethod
    def calculate_enhanced_confidence(entity, doc, context_window: int = 10) -> float:
        """Calculate enhanced confidence score"""
        base_confidence = 0.5
        
        # Length factor
        length_factor = min(1.0, len(entity.text) / 20.0)
        
        # Context factor
        start = max(0, entity.start_char - context_window)
        end = min(len(doc.text), entity.end_char + context_window)
        context = doc.text[start:end].lower()
        
        context_boost = 0
        if any(word in context for word in ['company', 'brand', 'product', 'service']):
            context_boost += 0.2
        if entity.text.istitle() or entity.text.isupper():
            context_boost += 0.1
        if any(char.isdigit() for char in entity.text):
            context_boost += 0.1
        
        # Position factor (entities at start of sentence are more likely to be important)
        if entity.start_char < 50:
            position_boost = 0.1
        else:
            position_boost = 0
        
        final_confidence = min(1.0, base_confidence + length_factor + context_boost + position_boost)
        return final_confidence

# Global instances
ner_cache = NERCache(max_size=1000, ttl=3600)
resource_monitor = ResourceMonitor()
model_selector = ModelSelector()
confidence_optimizer = ConfidenceOptimizer()

def optimize_ner_request(text: str, model: str, min_confidence: float, labels: Optional[List[str]]) -> Optional[Dict[str, Any]]:
    """Optimize NER request with caching and intelligent model selection"""
    
    # Check cache first
    cached_result = ner_cache.get(text, model, min_confidence, labels)
    if cached_result:
        logger.debug("Cache hit for NER request")
        return cached_result
    
    return None

def cache_ner_result(text: str, model: str, min_confidence: float, labels: Optional[List[str]], result: Dict[str, Any]):
    """Cache NER result"""
    ner_cache.set(text, model, min_confidence, labels, result)

def get_optimal_model(text: str, accuracy_required: bool = False) -> str:
    """Get optimal model for text"""
    return model_selector.select_model(text, accuracy_required)

def optimize_confidence(entity, doc) -> float:
    """Optimize confidence score"""
    return confidence_optimizer.calculate_enhanced_confidence(entity, doc)

def should_use_batch_processing(texts: List[str]) -> bool:
    """Determine if batch processing should be used"""
    return len(texts) > 5 and all(len(text) < 1000 for text in texts)

def get_performance_metrics() -> Dict[str, Any]:
    """Get current performance metrics"""
    return {
        "cache_size": len(ner_cache.cache),
        "avg_processing_time": resource_monitor.get_avg_processing_time(),
        "total_requests": resource_monitor.request_count,
        "should_optimize": resource_monitor.should_optimize()
    }