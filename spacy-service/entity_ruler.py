"""
Custom EntityRuler for brand and product recognition
"""
import spacy
from spacy.matcher import Matcher
from spacy.tokens import Span
from typing import List, Dict, Any
import json
import os

class BrandProductEntityRuler:
    """Custom entity ruler for brand and product recognition"""
    
    def __init__(self, nlp, model_name: str = "en_core_web_trf"):
        self.nlp = nlp
        self.model_name = model_name
        self.matcher = Matcher(nlp.vocab)
        self.brand_patterns = []
        self.product_patterns = []
        self.load_custom_patterns()
        self.setup_matchers()
    
    def load_custom_patterns(self):
        """Load custom patterns from file or create default ones"""
        patterns_file = "brand_product_patterns.json"
        
        if os.path.exists(patterns_file):
            with open(patterns_file, 'r') as f:
                patterns = json.load(f)
                self.brand_patterns = patterns.get('brands', [])
                self.product_patterns = patterns.get('products', [])
        else:
            # Default patterns for common brands and products
            self.brand_patterns = [
                {"label": "BRAND", "pattern": [{"LOWER": "gemini"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "contentstack"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "google"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "microsoft"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "apple"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "amazon"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "netflix"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "spotify"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "adobe"}]},
                {"label": "BRAND", "pattern": [{"LOWER": "salesforce"}]},
            ]
            
            self.product_patterns = [
                {"label": "PRODUCT", "pattern": [{"LOWER": "gemini"}, {"LOWER": "pro"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "gemini"}, {"LOWER": "flash"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "chatgpt"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "gpt"}, {"LOWER": "4"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "gpt"}, {"LOWER": "3.5"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "claude"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "midjourney"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "dall-e"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "photoshop"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "illustrator"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "premiere"}, {"LOWER": "pro"}]},
                {"label": "PRODUCT", "pattern": [{"LOWER": "after"}, {"LOWER": "effects"}]},
            ]
    
    def setup_matchers(self):
        """Setup spaCy matchers for custom patterns"""
        # Add brand patterns
        for pattern in self.brand_patterns:
            self.matcher.add(
                f"BRAND_{pattern['pattern'][0]['LOWER']}",
                [pattern['pattern']],
                on_match=self.create_entity_callback("BRAND")
            )
        
        # Add product patterns
        for i, pattern in enumerate(self.product_patterns):
            self.matcher.add(
                f"PRODUCT_{i}",
                [pattern['pattern']],
                on_match=self.create_entity_callback("PRODUCT")
            )
    
    def create_entity_callback(self, label: str):
        """Create callback function for entity creation"""
        def add_entity(matcher, doc, i, matches):
            match_id, start, end = matches[i]
            entity = Span(doc, start, end, label=label)
            doc.ents = list(doc.ents) + [entity]
        return add_entity
    
    def add_custom_pattern(self, label: str, pattern: List[Dict[str, Any]]):
        """Add a custom pattern dynamically"""
        pattern_id = f"CUSTOM_{label}_{len(self.matcher)}"
        self.matcher.add(pattern_id, [pattern], on_match=self.create_entity_callback(label))
    
    def process_text(self, text: str) -> List[Dict[str, Any]]:
        """Process text and return custom entities"""
        doc = self.nlp(text)
        
        # Apply custom matchers
        matches = self.matcher(doc)
        
        # Extract custom entities
        custom_entities = []
        for match_id, start, end in matches:
            entity_text = doc[start:end].text
            label = doc.vocab.strings[match_id].split('_')[0]  # Extract label from match_id
            
            # Calculate confidence based on pattern complexity and context
            confidence = self.calculate_confidence(doc, start, end, label)
            
            custom_entities.append({
                "text": entity_text,
                "label": label,
                "start": doc[start].idx,
                "end": doc[end].idx,
                "confidence": confidence,
                "source": "custom_ruler"
            })
        
        return custom_entities
    
    def calculate_confidence(self, doc, start: int, end: int, label: str) -> float:
        """Calculate confidence score for custom entities"""
        base_confidence = 0.8
        
        # Boost confidence for longer entities
        entity_length = end - start
        if entity_length > 2:
            base_confidence += 0.1
        
        # Boost confidence if entity appears in title case or proper context
        entity_text = doc[start:end].text
        if entity_text.istitle() or entity_text.isupper():
            base_confidence += 0.1
        
        # Boost confidence for known brand patterns
        if label == "BRAND" and any(brand in entity_text.lower() for brand in ["gemini", "google", "microsoft", "apple"]):
            base_confidence += 0.1
        
        return min(1.0, base_confidence)
    
    def save_patterns(self, filename: str = "brand_product_patterns.json"):
        """Save current patterns to file"""
        patterns = {
            "brands": self.brand_patterns,
            "products": self.product_patterns
        }
        with open(filename, 'w') as f:
            json.dump(patterns, f, indent=2)
    
    def load_training_data(self, training_file: str):
        """Load training data from file and extract patterns"""
        if not os.path.exists(training_file):
            return
        
        with open(training_file, 'r') as f:
            training_data = json.load(f)
        
        # Extract patterns from training data
        for item in training_data:
            if 'entities' in item:
                for entity in item['entities']:
                    if entity['label'] in ['BRAND', 'PRODUCT']:
                        # Convert entity to pattern
                        pattern = self.text_to_pattern(entity['text'])
                        if pattern:
                            if entity['label'] == 'BRAND':
                                self.brand_patterns.append({
                                    "label": entity['label'],
                                    "pattern": pattern
                                })
                            else:
                                self.product_patterns.append({
                                    "label": entity['label'],
                                    "pattern": pattern
                                })
        
        # Rebuild matchers with new patterns
        self.setup_matchers()
    
    def text_to_pattern(self, text: str) -> List[Dict[str, Any]]:
        """Convert text to spaCy pattern"""
        words = text.lower().split()
        pattern = []
        for word in words:
            # Handle special characters and numbers
            if word.isalnum():
                pattern.append({"LOWER": word})
            else:
                # For words with special characters, use more flexible matching
                pattern.append({"TEXT": {"REGEX": f".*{word}.*"}})
        return pattern