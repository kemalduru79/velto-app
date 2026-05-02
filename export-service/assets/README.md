# Background Music File

Audio Mixing v1 supports optional background music.

To enable it, place a loopable child-friendly instrumental file here with this exact name:

```
bgm.mp3
```

If `assets/bgm.mp3` is not present, the export service continues safely without background music.

Optional request body fields supported by `/export-movie`:

```json
{
  "backgroundMusicUrl": "https://.../bgm.mp3",
  "backgroundMusicVolume": 0.16
}
```

Recommended volume range: `0.12` to `0.20`.
