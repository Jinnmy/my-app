import argparse
import sys
import os
import onnxruntime
import numpy as np
from PIL import Image
from transformers import BlipProcessor

# Define model paths (relative to this script)
MODEL_ID = "Salesforce/blip-image-captioning-base"
VISION_MODEL_ONNX = os.path.join(os.path.dirname(__file__), "vision_model.onnx")
TEXT_DECODER_ONNX = os.path.join(os.path.dirname(__file__), "text_decoder_model.onnx")

def run_inference(image_path):
    if not os.path.exists(image_path):
        print(f"Error: Image {image_path} not found.", file=sys.stderr)
        sys.exit(1)
        
    if not os.path.exists(VISION_MODEL_ONNX) or not os.path.exists(TEXT_DECODER_ONNX):
         print("Error: ONNX models not found. Please run export_onnx.py first.", file=sys.stderr)
         sys.exit(1)

    try:
        # Load Processor (for tokenization and image processing)
        print("DEBUG: Loading processor...", file=sys.stderr)
        processor = BlipProcessor.from_pretrained(MODEL_ID)

        # Load ONNX sessions
        print("DEBUG: Loading ONNX sessions...", file=sys.stderr)
        vision_sess = onnxruntime.InferenceSession(VISION_MODEL_ONNX)
        text_sess = onnxruntime.InferenceSession(TEXT_DECODER_ONNX)

        # Preprocess image
        print(f"DEBUG: Processing image {image_path}...", file=sys.stderr)
        image = Image.open(image_path).convert('RGB')
        inputs = processor(images=image, return_tensors="np")
        pixel_values = inputs["pixel_values"]

        # Run Vision Model
        print("DEBUG: Running vision model...", file=sys.stderr)
        vision_inputs = {vision_sess.get_inputs()[0].name: pixel_values}
        vision_outputs = vision_sess.run(None, vision_inputs)
        image_embeds = vision_outputs[0]
        
        # Run Text Decoder (Greedy Search)
        print("DEBUG: Running text decoder...", file=sys.stderr)
        bos_token_id = processor.tokenizer.bos_token_id
        if bos_token_id is None:
            bos_token_id = processor.tokenizer.cls_token_id
            
        eos_token_id = processor.tokenizer.sep_token_id
        if processor.tokenizer.eos_token_id is not None:
            eos_token_id = processor.tokenizer.eos_token_id
        
        input_ids = np.array([[bos_token_id]], dtype=np.int64)
        attention_mask = np.ones(input_ids.shape, dtype=np.int64)
        encoder_attention_mask = np.ones(image_embeds.shape[:-1], dtype=np.int64)
        
        max_length = 50
        for i in range(max_length):
            text_inputs = {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "encoder_hidden_states": image_embeds
            }
            
            # Run inference
            logits = text_sess.run(None, text_inputs)[0]
            
            # Greedy decoding
            next_token_logits = logits[:, -1, :]
            next_token_id = np.argmax(next_token_logits, axis=-1)
            
            print(f"DEBUG: Step {i} - Token ID: {next_token_id[0]}", file=sys.stderr)

            # Append
            input_ids = np.concatenate([input_ids, next_token_id[:, None]], axis=1)
            attention_mask = np.concatenate([attention_mask, np.ones((1, 1), dtype=np.int64)], axis=1)
            
            if next_token_id[0] == eos_token_id:
                print("DEBUG: EOS token reached.", file=sys.stderr)
                break
                
        print(f"DEBUG: Final input_ids: {input_ids}", file=sys.stderr)
        caption = processor.decode(input_ids[0], skip_special_tokens=True)
        print(f"DEBUG: Raw Caption: '{caption}'", file=sys.stderr)
        # Print ONLY the caption to stdout so Node.js can capture it
        print(caption)
        sys.stdout.flush()

    except Exception as e:
        print(f"Error during inference: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='BLIP ONNX Inference Bridge')
    parser.add_argument('image_path', type=str, help='Path to the image file')
    args = parser.parse_args()
    
    run_inference(args.image_path)
