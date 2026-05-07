# VELTO Micro SFX Engine v1

This package updates `src/server.js` for the Railway export service.

## What changed

- Keeps the heavier procedural ambience engine disabled by default unless `ENABLE_AMBIENCE=true`.
- Adds a lightweight Micro SFX layer for noticeable scene accents.
- Automatically detects scene keywords such as rocket, underwater, magic, robot, explosion, and curiosity.
- Generates short, low-cost procedural SFX accents and mixes them into the scene audio.
- Keeps narration and Joe dialogue as the primary audio layer.

## Environment variables

Optional:

```env
ENABLE_MICRO_SFX=true
MICRO_SFX_MAX_SCENES=8
ENABLE_AMBIENCE=false
```

Recommended for stability:

```env
ENABLE_MICRO_SFX=true
ENABLE_AMBIENCE=false
```

## Deploy

Replace your Railway export service file:

```text
export-service/src/server.js
```

Then push Railway:

```bash
git add .
git commit -m "feat: add lightweight micro sfx engine"
git push
```
