# Room Scanic

**Visual + acoustic room capture on the web.**

Progressive device permissions · multi-view frames · room-response audio · motion trajectory · Spark volumetric viewer.

Inspired by the spatial intelligence surface of [World Labs / Marble](https://www.worldlabs.ai/).

## Live demo

**https://artsrun.github.io/room-scanic/**

GitHub Pages must deploy from **main** `/` (the `prod` branch is README-only). Open on a real phone — HTTPS is required for camera / mic.

## What it does

| Stage | Capture |
|-------|---------|
| **Visual** | Rear camera multi-view frames (canvas path — works on iOS) |
| **Acoustic** | Exponential sine sweep + **mic** record → approximate room response |
| **Motion** | Device orientation samples while you walk the room |
| **Viewer** | Spark 2.1 Gaussian splat field (`butterfly.spz` demo until a reconstruction pipeline exists) |

Browser limits are real: no LiDAR depth on pure web, no live 3DGS reconstruction client-side. Stored frames + audio + motion are the on-device payload for a later offline / server pipeline.

## Stack

- Single-file SPA (`index.html`)
- Three.js `0.180.0` + [Spark 2.1](https://sparkjs.dev/) (`SplatMesh` + `SparkRenderer`)
- getUserMedia · MediaRecorder · DeviceOrientation · Web Audio

## Local

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

## License

MIT
