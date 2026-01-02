from optimum.onnxruntime import ORTModelForSeq2SeqLM
from transformers import AutoTokenizer

def export_model(model_id="google/flan-t5-small", output_dir="flan_t5_onnx"):
    print(f"Loading and exporting model {model_id} to {output_dir}...")
    # export=True forces the conversion to ONNX
    model = ORTModelForSeq2SeqLM.from_pretrained(model_id, export=True)
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print("Export complete!")

if __name__ == "__main__":
    export_model()
