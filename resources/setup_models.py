import os
import sys
import torch
import numpy as np
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration, AutoTokenizer
from optimum.onnxruntime import ORTModelForSeq2SeqLM
import onnxruntime

# Force UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# --- Configuration ---
BLIP_MODEL_ID = "Salesforce/blip-image-captioning-base"
FLAN_MODEL_ID = "google/flan-t5-small"
HEALTH_MODEL_URL = "https://github.com/Jinnmy/ai_things/raw/main/health_model.onnx"

# Paths (Relative to this script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BLIP_DIR = os.path.join(BASE_DIR, "blip")
FLAN_DIR = os.path.join(BASE_DIR, "python", "flan_t5_onnx")
HW_MONITOR_DIR = os.path.join(BASE_DIR, "hardware-monitor")

# Expected Files
BLIP_VISION_ONNX = os.path.join(BLIP_DIR, "vision_model.onnx")
BLIP_TEXT_ONNX = os.path.join(BLIP_DIR, "text_decoder_model.onnx")
FLAN_ENCODER_ONNX = os.path.join(FLAN_DIR, "encoder_model.onnx")
FLAN_DECODER_ONNX = os.path.join(FLAN_DIR, "decoder_model.onnx") # Optimum exports multiple files
HEALTH_MODEL_ONNX = os.path.join(HW_MONITOR_DIR, "health_model.onnx")

def check_blip_status():
    return os.path.exists(BLIP_VISION_ONNX) and os.path.exists(BLIP_TEXT_ONNX)

def check_flan_status():
    # Only checking for encoder as a proxy for now, but ideally check all
    return os.path.exists(FLAN_ENCODER_ONNX)

def setup_blip():
    print(f"Setting up BLIP model in {BLIP_DIR}...")
    
    if not os.path.exists(BLIP_DIR):
        os.makedirs(BLIP_DIR)

    if check_blip_status():
        print("BLIP models already exist.")
        return

    print(f"Loading base model {BLIP_MODEL_ID}...")
    processor = BlipProcessor.from_pretrained(BLIP_MODEL_ID)
    model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL_ID)
    model.eval()

    # Create dummy input
    dummy_image = Image.new('RGB', (384, 384))
    inputs = processor(images=dummy_image, return_tensors="pt")
    pixel_values = inputs["pixel_values"]

    # 1. Export Vision Model
    print("Exporting Vision Model to ONNX...")
    with torch.no_grad():
        torch.onnx.export(
            model.vision_model, 
            pixel_values, 
            BLIP_VISION_ONNX, 
            input_names=["pixel_values"],
            output_names=["last_hidden_state", "pooler_output"],
            dynamic_axes={"pixel_values": {0: "batch_size"}},
            opset_version=18
        )

    # 2. Export Text Decoder
    print("Exporting Text Decoder to ONNX...")
    text_decoder = model.text_decoder
    text_decoder.config.use_cache = False
    
    # Dummy inputs for decoder
    vision_outputs = model.vision_model(pixel_values)
    image_embeds = vision_outputs[0]
    image_attention_mask = torch.ones(image_embeds.size()[:-1], dtype=torch.long)
    image_attention_mask = torch.ones(image_embeds.size()[:-1], dtype=torch.long)
    # Trace with a sequence length > 1 to avoid hardcoding shapes for length 1
    input_ids = torch.tensor([[30522, 101, 102, 103, 104]], dtype=torch.long) # Length 5
    attention_mask = torch.ones(input_ids.shape, dtype=torch.long)
    
    # Wrapper for export
    class TextDecoderWrapper(torch.nn.Module):
        def __init__(self, decoder):
            super().__init__()
            self.decoder = decoder
        
        def forward(self, input_ids, attention_mask, encoder_hidden_states, encoder_attention_mask):
            return self.decoder(
                input_ids=input_ids,
                attention_mask=attention_mask,
                encoder_hidden_states=encoder_hidden_states,
                encoder_attention_mask=encoder_attention_mask
            )
    
    wrapper = TextDecoderWrapper(text_decoder)
    
    with torch.no_grad():
        torch.onnx.export(
            wrapper,
            (input_ids, attention_mask, image_embeds, image_attention_mask),
            BLIP_TEXT_ONNX,
            input_names=["input_ids", "attention_mask", "encoder_hidden_states", "encoder_attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "seq_len"},
                "attention_mask": {0: "batch_size", 1: "seq_len"},
                "encoder_hidden_states": {0: "batch_size", 1: "seq_len_img"},
                "encoder_attention_mask": {0: "batch_size", 1: "seq_len_img"}
            },
            opset_version=18
        )
    print("BLIP export complete.")

def setup_flan():
    print(f"Setting up Flan-T5 model in {FLAN_DIR}...")

    if not os.path.exists(FLAN_DIR):
        os.makedirs(FLAN_DIR)

    if check_flan_status():
        print("Flan-T5 models already exist.")
        return

    print(f"Loading and exporting model {FLAN_MODEL_ID}...")
    # Optimum handles the export automatically
    model = ORTModelForSeq2SeqLM.from_pretrained(FLAN_MODEL_ID, export=True)
    tokenizer = AutoTokenizer.from_pretrained(FLAN_MODEL_ID)
    
    model.save_pretrained(FLAN_DIR)
    tokenizer.save_pretrained(FLAN_DIR)
    print("Flan-T5 export complete.")

def setup_health_model():
    print(f"Setting up Health Model in {HW_MONITOR_DIR}...")
    if not os.path.exists(HW_MONITOR_DIR):
        os.makedirs(HW_MONITOR_DIR)

    if os.path.exists(HEALTH_MODEL_ONNX):
        print("Health model already exists.")
        return

    print("Downloading health model...")
    import urllib.request
    try:
        # Download ONNX
        urllib.request.urlretrieve(HEALTH_MODEL_URL, HEALTH_MODEL_ONNX)
        print("Health model ONNX downloaded successfully.")
        
        # Check for associated .data file (some exports use external data)
        # We try to download it if it exists. If it doesn't (404), we assume it's not needed.
        data_url = HEALTH_MODEL_URL + ".data"
        data_path = HEALTH_MODEL_ONNX + ".data"
        try:
            print(f"Checking for associated data file at {data_url}...")
            urllib.request.urlretrieve(data_url, data_path)
            print("Associated health model data file downloaded.")
        except Exception:
            # If 404 or other error, we assume no .data file is required for this model
            print("No associated data file found (standard for small models).")
            if os.path.exists(data_path):
                os.remove(data_path)
    except Exception as e:
        print(f"Failed to download health model: {e}")
        raise e

def check_smartctl_status():
    """Checks if smartctl is available."""
    # This logic should mirror hardware_monitor.py or just use 'where'
    import subprocess
    try:
        result = subprocess.run(['where', 'smartctl'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
            return True
        # Check common paths
        common_paths = [
            r"C:\Program Files\smartmontools\bin\smartctl.exe",
            r"C:\Program Files (x86)\smartmontools\bin\smartctl.exe"
        ]
        for path in common_paths:
            if os.path.exists(path):
                return True
    except:
        pass
    return False

if __name__ == "__main__":
    print("Starting AI Model Setup...")
    try:
        setup_blip()
        setup_flan()
        setup_health_model()
        
        print("\nChecking system dependencies...")
        if check_smartctl_status():
            print("smartctl is available.")
        else:
            print("WARNING: smartctl not found. Hardware monitoring will have limited functionality.")
            print("Recommendation: Run 'winget install smartmontools' in an admin terminal.")
            
        print("\nAll models setup successfully!")
    except Exception as e:
        print(f"Error during setup: {e}", file=sys.stderr)
        sys.exit(1)
