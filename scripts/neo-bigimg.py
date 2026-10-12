"""Crea immagine >10MB e testa il downscale PowerShell."""
import pathlib
import numpy as np
from PIL import Image

p = pathlib.Path("site-lab/_big.png")
if not p.exists() or p.stat().st_size < 10 * 1024 * 1024:
    img = Image.fromarray(
        np.random.default_rng(3).integers(0, 256, (3000, 4000, 3), dtype="uint8"))
    img.save(p)
print("big:", round(p.stat().st_size / 1024 / 1024, 1), "MB")
