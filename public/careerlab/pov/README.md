# VELTO Career Lab POV Layer Architecture

This folder contains the layered profession-specific POV assets used by Career Lab.

The UI no longer treats the profession image as a single flat background. Each profession can use three visual layers:

1. `base.webp` — the main environment view.
2. `*-overlay.webp` — profession-specific HUD / monitor / radar / data overlay.
3. `*-glass.webp`, `*-reflection.webp`, `*-noise.webp`, or `*-glow.webp` — foreground glass, reflection, distortion, or atmosphere layer.

## Folder structure

```txt
/public/careerlab/pov/
├── astronaut/
│   ├── base.webp
│   ├── visor-overlay.webp
│   └── oxygen-reflection.webp
├── doctor/
│   ├── base.webp
│   ├── monitor-overlay.webp
│   └── er-glass.webp
├── pilot/
│   ├── base.webp
│   ├── radar-overlay.webp
│   └── canopy-glass.webp
├── ai-engineer/
│   ├── base.webp
│   ├── data-grid.webp
│   └── lab-glow.webp
└── cyber-detective/
    ├── base.webp
    ├── secure-network.webp
    └── digital-noise.webp
```

## Image rules

- Use WebP.
- Recommended: 1920x1080 or 1792x1024.
- Do not include readable text inside the images.
- Keep the center area calm and readable.
- Put visual richness near edges, corners, glass, frames, and instruments.
- These images are POV immersion assets, not decorative backgrounds.

If a layer image is not present yet, the CSS/HUD fallback still keeps the mission screen usable.
