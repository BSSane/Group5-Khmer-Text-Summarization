import torch
from transformers import MBart50Tokenizer, MBartForConditionalGeneration
import os
import re

class KhmerSummarizer:
    def __init__(self, model_path='./models/khmer_summarization_model'):
        self.model = None
        self.tokenizer = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        print(f"🔧 Device: {self.device}")
        
        # Try to load model on initialization
        try:
            if model_path and os.path.exists(model_path):
                self.load_model(model_path)
            else:
                print(f"Model path not found: {model_path}")
                print("→ Using fallback extractive summarization")
        except Exception as e:
            print(f"Failed to initialize model: {e}")
            print("→ Using fallback extractive summarization")
    
    def load_model(self, model_path):
        """Load your trained Khmer summarization model"""
        try:
            print(f"📂 Loading from: {model_path}")
            
            if os.path.exists(model_path):
                files = os.listdir(model_path)
                
                # Load tokenizer
                try:
                    self.tokenizer = MBart50Tokenizer.from_pretrained(model_path)
                    print("✓ Tokenizer loaded successfully")
                except Exception as e:
                    print(f"⚠️  Could not load tokenizer: {e}")
                
                # Check for model weights
                has_weights = any(
                    f in files for f in ['pytorch_model.bin', 'model.safetensors', 'tf_model.h5']
                )
                
                if not has_weights:
                    print("⚠️  Model weights not found!")
                    print(f"   Looking for: pytorch_model.bin or model.safetensors")
                    print(f"   Found: {files}")
                    print("→ Using extractive summarization with tokenizer")
                    return
                
                # Try loading the model
                try:
                    self.model = MBartForConditionalGeneration.from_pretrained(model_path)
                    self.model.to(self.device)
                    self.model.eval()
                    print(f"✓ Model loaded successfully on {self.device}")
                except Exception as e:
                    print(f"❌ Failed to load model: {e}")
                    print("→ Using extractive summarization")
        
        except Exception as e:
            print(f"❌ Error: {e}")
            print("→ Using fallback method")
    
    def summarize(self, text, max_length=150, min_length=50):
        """Generate summary from input text"""
        if self.model is None:
            return self._extractive_summarize(text, max_length)
        
        try:
            # Tokenize input
            inputs = self.tokenizer(
                text,
                max_length=1024,
                truncation=True,
                return_tensors='pt'
            ).to(self.device)
            
            # Generate summary
            with torch.no_grad():
                summary_ids = self.model.generate(
                    inputs['input_ids'],
                    max_length=max_length,
                    min_length=min_length,
                    num_beams=4,
                    length_penalty=2.0,
                    early_stopping=True,
                    no_repeat_ngram_size=3
                )
            
            # Decode summary
            summary = self.tokenizer.decode(
                summary_ids[0],
                skip_special_tokens=True
            )
            
            return summary
        
        except Exception as e:
            print(f"❌ Error during summarization: {e}")
            return self._extractive_summarize(text, max_length)
    
    def _extractive_summarize(self, text, max_length):
        """Improved extractive summarization for Khmer text"""
        # Split by Khmer sentence delimiter
        sentences = re.split(r'[។៕]', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return text[:max_length]
        
        # Simple scoring: prefer longer sentences (more information)
        scored_sentences = []
        for i, sent in enumerate(sentences):
            # Score based on length and position (earlier sentences often more important)
            score = len(sent) * (1 - i * 0.1 / len(sentences))
            scored_sentences.append((score, sent, i))
        
        # Sort by score
        scored_sentences.sort(reverse=True)
        
        # Select sentences up to max_length
        summary_parts = []
        current_length = 0
        
        for score, sent, original_idx in scored_sentences:
            sent_with_delimiter = sent + '។'
            if current_length + len(sent_with_delimiter) <= max_length:
                summary_parts.append((original_idx, sent_with_delimiter))
                current_length += len(sent_with_delimiter)
            
            if current_length >= max_length * 0.8:  # 80% of max_length
                break
        
        # Sort by original order to maintain coherence
        summary_parts.sort(key=lambda x: x[0])
        summary = ' '.join([part[1] for part in summary_parts])
        
        return summary if summary else text[:max_length]
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None