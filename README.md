# Room Scanic

Visual + acoustic room capture on the web. Spark Gaussian splat viewer.

**https://artsrun.github.io/room-scanic/**

## v0.2

- Modular SPA (`js/*`, `css/app.css`) instead of one 44k HTML blob
- Spark **2.2.0** + Three r180
- Official Spark / World Labs models from `https://sparkjs.dev/assets/splats/` (catalog in `models/catalog.json`)
- Full-bleed splat viewer, model chips, load progress, `setAnimationLoop` FPS
- Capture finish unlocks at **1** frame (sweep optional)
- After a scan, “View as splats” builds a proxy field from captured frames via Spark `imageSplats`

Browser still cannot do live 3DGS reconstruction. Frames + sweep + orientation are the on-device payload.

## Pages

Deploy from **main** / root. `prod` is README-only.

## Local

```bash
python3 -m http.server 8765
```

## Stack

getUserMedia · MediaRecorder · DeviceOrientation · Web Audio · Three.js · [Spark](https://sparkjs.dev/)

## License

MIT
