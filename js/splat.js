import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh, imageSplats } from '@sparkjsdev/spark';
import { modelById, sparkUrl } from './catalog.js';
import { state } from './state.js';
import { $, toast, setBadge } from './ui.js';

const splat = {
  token: 0,
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  spark: null,
  mesh: null,
  ro: null,
  autoRotate: false,
};

const disposeMesh = (mesh) => {
  if (!mesh) return;
  mesh.removeFromParent?.();
  mesh.dispose?.();
};

export const disposeSplat = () => {
  splat.token += 1;
  splat.autoRotate = false;
  splat.ro?.disconnect();
  splat.ro = null;
  splat.controls?.dispose?.();
  disposeMesh(splat.mesh);
  splat.spark?.removeFromParent?.();
  splat.spark?.dispose?.();
  if (splat.renderer) {
    splat.renderer.setAnimationLoop(null);
    splat.renderer.domElement?.remove();
    splat.renderer.dispose();
  }
  splat.renderer = splat.scene = splat.camera = splat.controls = splat.spark = splat.mesh = null;
  const fps = $('splat-fps');
  if (fps) fps.textContent = '— fps';
  const auto = $('btn-splat-auto');
  if (auto) auto.textContent = 'Auto Rotate';
};

const fitCamera = (mesh, camera, controls) => {
  const box = new THREE.Box3().setFromObject(mesh);
  if (!Number.isFinite(box.min.x)) {
    camera.position.set(0, 0.4, 3);
    controls.target.set(0, 0, 0);
    controls.saveState();
    return;
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.55, 0.8);
  camera.position.set(center.x, center.y + radius * 0.15, center.z + radius * 1.6);
  controls.target.copy(center);
  controls.minDistance = radius * 0.15;
  controls.maxDistance = radius * 12;
  controls.saveState();
};

const makeSparkMesh = (id) => {
  const model = modelById(id);
  const mesh = new SplatMesh({
    url: sparkUrl(model.file),
    onProgress: (ev) => {
      if (!ev?.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      setBadge('splat-status-badge', `${pct}%`);
    },
  });
  mesh.quaternion.set(1, 0, 0, 0);
  return { mesh, label: model.name };
};

const makeFrameMesh = (urls) => {
  const group = new THREE.Group();
  urls.slice(0, 3).forEach((url, i) => {
    const mesh = imageSplats({
      url,
      subXY: 3,
      forEachSplat: (_w, _h, _i, _c, _s, _q, opacity) => (opacity >= 0.08 ? opacity : null),
    });
    mesh.position.set((i - 1) * 1.15, 0, -i * 0.35);
    group.add(mesh);
  });
  return { mesh: group, label: 'Session frames' };
};

export const loadSplatSource = async (pending = state.pendingSplat) => {
  if (!splat.scene) return;
  setBadge('splat-status-badge', 'loading');
  const nameEl = $('splat-model-name');
  disposeMesh(splat.mesh);
  splat.mesh = null;

  const built = pending?.kind === 'frames' && pending.urls?.length
    ? makeFrameMesh(pending.urls)
    : makeSparkMesh(pending?.id || 'butterfly');

  splat.scene.add(built.mesh);
  splat.mesh = built.mesh;
  if (nameEl) nameEl.textContent = built.label;

  const ready = built.mesh.initialized
    ? built.mesh.initialized
    : Promise.all(built.mesh.children.map((c) => c.initialized).filter(Boolean));
  await ready;
  fitCamera(built.mesh, splat.camera, splat.controls);
  setBadge('splat-status-badge', 'live');
};

export const initSplat = async () => {
  if (splat.renderer) {
    await loadSplatSource();
    return;
  }

  const mount = $('splat-mount');
  const badgeToken = splat.token;
  setBadge('splat-status-badge', 'loading');
  mount.querySelectorAll('canvas').forEach((c) => c.remove());

  const W = Math.max(mount.clientWidth, 1);
  const H = Math.max(mount.clientHeight, 1);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x050506, 1);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, W / H, 0.01, 2000);
  camera.position.set(0, 0.35, 3);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.update();

  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  splat.renderer = renderer;
  splat.scene = scene;
  splat.camera = camera;
  splat.controls = controls;
  splat.spark = spark;

  let frames = 0;
  let fpsT = performance.now();
  renderer.setAnimationLoop(() => {
    if (badgeToken !== splat.token) return;
    controls.autoRotate = splat.autoRotate;
    controls.update();
    renderer.render(scene, camera);
    frames += 1;
    const now = performance.now();
    if (now - fpsT >= 1000) {
      const el = $('splat-fps');
      if (el) el.textContent = `${frames} fps`;
      frames = 0;
      fpsT = now;
    }
  });

  splat.ro = new ResizeObserver(() => {
    const nW = Math.max(mount.clientWidth, 1);
    const nH = Math.max(mount.clientHeight, 1);
    camera.aspect = nW / nH;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(nW, nH, false);
  });
  splat.ro.observe(mount);

  try {
    await loadSplatSource();
  } catch (err) {
    console.error(err);
    try {
      if (state.pendingSplat?.kind !== 'spark' || state.pendingSplat?.id !== 'butterfly') {
        state.pendingSplat = { kind: 'spark', id: 'butterfly' };
        await loadSplatSource();
        return;
      }
    } catch { /* fall through */ }
    setBadge('splat-status-badge', 'error');
    toast(`Splat failed — ${err?.message || 'load error'}`);
  }
};

export const resetSplatCamera = () => {
  splat.autoRotate = false;
  splat.controls?.reset();
  splat.controls?.update();
  const auto = $('btn-splat-auto');
  if (auto) auto.textContent = 'Auto Rotate';
};

export const toggleAutoRotate = () => {
  splat.autoRotate = !splat.autoRotate;
  if (splat.controls) splat.controls.autoRotate = splat.autoRotate;
  const auto = $('btn-splat-auto');
  if (auto) auto.textContent = splat.autoRotate ? 'Stop Rotate' : 'Auto Rotate';
};
