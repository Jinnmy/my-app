import argparse
import os
import sys
import json
from optimum.onnxruntime import ORTModelForSeq2SeqLM
from transformers import AutoTokenizer
import docx

# Redirect stderr for logging
def log(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def read_file(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    elif ext == ".docx":
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
    else:
        raise ValueError(f"Unsupported file extension: {ext}. Only .txt and .docx are supported.")

def chunk_text(text, chunk_size=2000):
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i+chunk_size])
    return chunks

def summarize(text, model_path):
    log(f"Loading model from {model_path}...")
    try:
        model = ORTModelForSeq2SeqLM.from_pretrained(model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path)
    except Exception as e:
        log(f"Error loading model: {e}")
        raise e

    chunks = chunk_text(text)
    log(f"Document length: {len(text)} chars. Splitting into {len(chunks)} chunks.")
    
    summaries = []
    for i, chunk in enumerate(chunks):
        log(f"Processing chunk {i+1}/{len(chunks)}...")
        input_text = "summarize: " + chunk
        inputs = tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
        
        outputs = model.generate(
            **inputs, 
            max_length=75, 
            min_length=20, 
            length_penalty=2.0, 
            num_beams=4, 
            early_stopping=True,
            no_repeat_ngram_size=3,
            repetition_penalty=1.2
        )
        chunk_summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
        summaries.append(chunk_summary)
        
    final_summary = " ".join(summaries)
    return final_summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Summarize document for Node.js integration")
    parser.add_argument("file_path", type=str, help="Path to .txt or .docx file")
    parser.add_argument("--model_dir", type=str, default="flan_t5_onnx", help="Directory containing the ONNX model")
    args = parser.parse_args()

    # Determine absolute path to model dir relative to script location if not provided purely absolute
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir = args.model_dir
    if not os.path.isabs(model_dir):
        model_dir = os.path.join(script_dir, model_dir)

    try:
        content = read_file(args.file_path)
        if not content.strip():
            log("File is empty.")
            print("") # Empty output
        else:
            summary = summarize(content, model_dir)
            # Output ONLY the summary to stdout
            print(summary)
            sys.stdout.flush()
            
    except Exception as e:
        log(f"Error: {e}")
        sys.exit(1)
