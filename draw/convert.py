import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Conv2d(1, 32, 3, padding=1),
    nn.ReLU(),
    nn.MaxPool2d(2),
    nn.Conv2d(32, 64, 3, padding=1),
    nn.ReLU(),
    nn.MaxPool2d(2),
    nn.Flatten(),
    nn.Linear(3136, 128),
    nn.ReLU(),
    nn.Linear(128, 10),
)
model.load_state_dict(torch.load('model.pth'))
model.eval()

dummy = torch.randn(1, 1, 28, 28)
torch.onnx.export(model, dummy, 'model.onnx',
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
    dynamo=False
)
print("Exported model.onnx")
