# Room Scanic

**Visual + acoustic room capture on the web.**

Progressive device permissions · multi-view frames · room-response audio · motion trajectory · Spark volumetric viewer.

Inspired by the spatial intelligence surface of [World Labs / Marble](https://www.worldlabs.ai/).

## Live demo

After enabling GitHub Pages (Settings → Pages → Deploy from **main** / root):

- Deploy production from **main** / `/`
- Treat `prod` as README-only; it is not the Pages source branch

**https://artsrun.github.io/room-scanic/**

Open on a real phone (HTTPS required for camera / mic).

## What it does

| Stage | Capture |
|-------|---------|
| **Visual** | Rear camera multi-view frames (canvas path — works on iOS) |
| **Acoustic** | Exponential sine sweep + mic record of the room → approximate room response |
| **Motion** | Device orientation samples while you walk the room |
| **Viewer** | Spark 2.1 `SplatMesh` Gaussian splat field with the official `butterfly.spz` demo asset |

Browser limits are real: no LiDAR depth on pure web, no live 3DGS reconstruction client-side. Stored frames + audio + motion are the on-device payload for later offline / server pipelines.

## Stack

- Single-file SPA (`index.html`)
- Three.js + [Spark](https://sparkjs.dev/) (World Labs)
- getUserMedia · MediaRecorder · DeviceOrientation · Web Audio

The splat viewer uses Spark 2.1 `SplatMesh` and the official demo asset:

- `https://sparkjs.dev/assets/splats/butterfly.spz`

The acoustic sweep records the room through the microphone stream when mic permission is granted; it does not record the generated oscillator tap.

## Local

```bash
python3 -m http.server 8765
# open http://localhost:8765
```

## License

MIT
