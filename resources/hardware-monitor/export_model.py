import torch
import torch.nn as nn
import os
import sys

# Force UTF-8 for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

class Autoencoder(nn.Module):
    def __init__(self, input_dim):
        super(Autoencoder, self).__init__()
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 4),  # Latent space
            nn.ReLU()
        )
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, input_dim),
            nn.Sigmoid() # Attributes normalized 0-1
        )

    def forward(self, x):
        latent = self.encoder(x)
        reconstructed = self.decoder(latent)
        return reconstructed

def export():
    input_dim = 14
    model_path = 'resources/hardware-monitor/health_model.pth'
    onnx_path = 'resources/hardware-monitor/health_model.onnx'
    
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found.")
        return

    model = Autoencoder(input_dim)
    try:
        model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
        print("Model loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    model.eval()
    
    # Create dummy input
    dummy_input = torch.randn(1, input_dim)
    
    # Export to ONNX - ensures it's a single file without external data
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}},
        opset_version=12
    )
    print(f"Model exported to {onnx_path}")

if __name__ == "__main__":
    export()
