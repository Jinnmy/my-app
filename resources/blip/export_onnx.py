from optimum.onnxruntime import ORTModelForZeroShotImageClassification
from transformers import CLIPProcessor

def export_model(model_id="openai/clip-vit-base-patch32", output_dir="onnx_models"):
    print(f"Loading and exporting model {model_id} to {output_dir}...")
    # This will load the model from Hub, export it to ONNX, and save it to output_dir
    model = ORTModelForZeroShotImageClassification.from_pretrained(model_id, export=True)
    processor = CLIPProcessor.from_pretrained(model_id)
    
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)
    print("Export complete!")

if __name__ == "__main__":
    export_model()
