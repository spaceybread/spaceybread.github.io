import json
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

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

params = {}
for name, tensor in model.named_parameters():
    params[name] = tensor.detach().numpy().tolist()

with open('model.json', 'w') as f:
    json.dump(params, f)
