# Cinematic Motion Engine v1 Final

This package updates only `export-service/src/server.js`.

Changes included:
- Preserves current CORS preflight fix.
- Preserves current export pipeline.
- Adds subtle cinematic motion to image-based scenes.
- Uses FFmpeg zoompan for slow zoom + small drift.
- Existing video sources are not altered; motion is applied to image scenes converted into video.

Install:
Replace your existing `export-service/src/server.js` with the file in this package, then run:

```bash
git add export-service/src/server.js
git commit -m "feat: add cinematic motion engine for image scenes"
git push
```

Local test:
Set `NEXT_PUBLIC_EXPORT_API_URL=http://localhost:3001`, run export-service locally, then export a video that uses image scenes.
