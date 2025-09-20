"""
Custom NER Model Training Script
Trains a lightweight custom model on brand/product data
"""

import spacy
import json
import random
from pathlib import Path
from spacy.tokens import DocBin
from spacy.util import filter_spans
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_training_data(file_path: str):
    """Load training data from JSON file"""
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    training_data = []
    for item in data:
        text = item['text']
        entities = item['entities']
        
        # Convert to spaCy format
        spacy_entities = []
        for ent in entities:
            spacy_entities.append((ent['start'], ent['end'], ent['label']))
        
        training_data.append((text, {"entities": spacy_entities}))
    
    return training_data

def create_training_data(training_data, output_file: str):
    """Convert training data to spaCy DocBin format"""
    nlp = spacy.blank("en")  # Start with blank model
    db = DocBin()
    
    for text, annotations in training_data:
        doc = nlp.make_doc(text)
        ents = []
        
        for start, end, label in annotations["entities"]:
            span = doc.char_span(start, end, label=label, alignment_mode="contract")
            if span is not None:
                ents.append(span)
        
        # Filter overlapping spans
        filtered_ents = filter_spans(ents)
        doc.ents = filtered_ents
        
        db.add(doc)
    
    db.to_disk(output_file)
    logger.info(f"Training data saved to {output_file}")

def train_custom_model(training_data_file: str, output_dir: str, iterations: int = 20):
    """Train a custom NER model"""
    
    # Load training data
    training_data = load_training_data(training_data_file)
    logger.info(f"Loaded {len(training_data)} training examples")
    
    # Create DocBin for training
    create_training_data(training_data, f"{output_dir}/training_data.spacy")
    
    # Create blank model
    nlp = spacy.blank("en")
    
    # Add NER component
    if "ner" not in nlp.pipe_names:
        ner = nlp.add_pipe("ner", last=True)
    else:
        ner = nlp.get_pipe("ner")
    
    # Add labels
    labels = set()
    for text, annotations in training_data:
        for start, end, label in annotations["entities"]:
            labels.add(label)
    
    for label in labels:
        ner.add_label(label)
    
    logger.info(f"Added labels: {list(labels)}")
    
    # Load training data
    train_data = DocBin().from_disk(f"{output_dir}/training_data.spacy")
    
    # Split data for training and evaluation
    random.shuffle(train_data)
    split = int(0.8 * len(train_data))
    train_docs = train_data[:split]
    dev_docs = train_data[split:]
    
    # Save dev data
    dev_docs.to_disk(f"{output_dir}/dev_data.spacy")
    
    # Initialize model
    nlp.begin_training()
    
    # Training loop
    for itn in range(iterations):
        random.shuffle(train_docs)
        losses = {}
        
        # Batch the examples
        batches = spacy.util.minibatch(train_docs, size=spacy.util.compounding(4.0, 32.0, 1.001))
        
        for batch in batches:
            nlp.update(batch, drop=0.5, losses=losses)
        
        logger.info(f"Iteration {itn + 1}/{iterations}, Losses: {losses}")
    
    # Save model
    nlp.to_disk(output_dir)
    logger.info(f"Model saved to {output_dir}")
    
    return nlp

def evaluate_model(nlp, dev_data_file: str):
    """Evaluate the trained model"""
    dev_data = DocBin().from_disk(dev_data_file)
    
    correct = 0
    total = 0
    
    for doc in dev_data:
        test_doc = nlp(doc.text)
        
        # Count correct predictions
        for ent in test_doc.ents:
            total += 1
            # Check if this entity matches any in the gold standard
            for gold_ent in doc.ents:
                if (ent.start_char == gold_ent.start_char and 
                    ent.end_char == gold_ent.end_char and 
                    ent.label_ == gold_ent.label_):
                    correct += 1
                    break
    
    accuracy = correct / total if total > 0 else 0
    logger.info(f"Model accuracy: {accuracy:.2%} ({correct}/{total})")
    
    return accuracy

def main():
    """Main training function"""
    training_file = "training_data.json"
    output_dir = "custom_ner_model"
    
    # Create output directory
    Path(output_dir).mkdir(exist_ok=True)
    
    # Train model
    logger.info("Starting custom model training...")
    nlp = train_custom_model(training_file, output_dir, iterations=30)
    
    # Evaluate model
    logger.info("Evaluating model...")
    evaluate_model(nlp, f"{output_dir}/dev_data.spacy")
    
    logger.info("Training complete!")

if __name__ == "__main__":
    main()