# nimpy.github.io

Personal portfolio site for Nina Žižakić, served at [žižakić.com](https://xn--iaki-ota32eb.com).

Static HTML/CSS/JS — no build step, no frameworks. The background is an interactive Julia set fractal rendered in real-time via a WebGL fragment shader.

## Updating the word embeddings

The [Latent Space](latent-space.html) page visualizes all words from the site in a 3D embedding space. To regenerate after updating content:

```bash
python scripts/generate-embeddings.py
```

Reads API credentials from `.env` in the repo root. Requires `numpy`, `scikit-learn`, and `openai` (`pip install numpy scikit-learn openai`).
