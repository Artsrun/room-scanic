import { state, persist, setPendingFrames } from './state.js';
import { $, toast, setBadge } from './ui.js';

export const MAX_FRAMES = 3;
export let capturedFrames = 0;

export const resetCapture = () => {
  capturedFrames = 0;
  state.frameCanvases = [];
  state.sweepDone = false;
  [1, 2, 3].forEach((i) => {
    const c = $(`frame-${i}`);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  });
  updateFrameUI();
  const sweep = $('sweep-status');
  if (sweep) sweep.textContent = 'idle';
  setBadge('capture-status-badge', 'ready');
};

export const updateFrameUI = () => {
  const count = $('frame-count');
  if (count) count.textContent = `${capturedFrames} / ${MAX_FRAMES}`;
  const fill = $('frame-progress');
  if (fill) fill.style.width = `${(capturedFrames / MAX_FRAMES) * 100}%`;
  const finish = $('btn-finish');
  if (finish) finish.disabled = capturedFrames < 1;
  if (capturedFrames >= MAX_FRAMES) setBadge('capture-status-badge', 'complete');
  else if (capturedFrames > 0) setBadge('capture-status-badge', `${capturedFrames}/${MAX_FRAMES}`);
  else setBadge('capture-status-badge', 'ready');
};

export const requestCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    state.stream = stream;
    const v = $('live-video');
    if (v) v.srcObject = stream;
    state.perms.camera = true;
    setBadge('badge-camera', 'granted');
    return true;
  } catch (e) {
    setBadge('badge-camera', 'denied');
    console.warn('Camera:', e.message);
    return false;
  }
};

export const requestMic = async () => {
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    state.perms.mic = true;
    setBadge('badge-mic', 'granted');
    return true;
  } catch (e) {
    setBadge('badge-mic', 'denied');
    console.warn('Mic:', e.message);
    return false;
  }
};

const startOrientation = () => {
  if (startOrientation.started) return;
  startOrientation.started = true;
  window.addEventListener('deviceorientation', (e) => {
    state.orientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma, absolute: e.absolute };
    const set = (id, v, suffix = '°') => {
      const el = $(id);
      if (el) el.textContent = v != null ? `${Number(v).toFixed(1)}${suffix}` : '—';
    };
    set('ori-alpha', e.alpha);
    set('ori-beta', e.beta);
    set('ori-gamma', e.gamma);
    const abs = $('ori-abs');
    if (abs) abs.textContent = e.absolute ? 'yes' : 'no';
  }, { passive: true });
};

export const requestMotion = async () => {
  if (typeof DeviceOrientationEvent === 'undefined') {
    setBadge('badge-motion', 'n/a');
    return false;
  }
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        state.perms.motion = true;
        setBadge('badge-motion', 'granted');
        startOrientation();
        return true;
      }
      setBadge('badge-motion', 'denied');
    } catch {
      setBadge('badge-motion', 'denied');
    }
    return false;
  }
  state.perms.motion = true;
  setBadge('badge-motion', 'granted');
  startOrientation();
  return true;
};

export const grantAll = async () => {
  const cam = await requestCamera();
  await requestMic();
  await requestMotion();
  return cam || state.perms.mic;
};

export const ensurePreview = async () => {
  if (state.stream) {
    const v = $('live-video');
    if (v && !v.srcObject) v.srcObject = state.stream;
    return;
  }
  if (state.perms.camera) await requestCamera();
};

export const snapFrame = () => {
  const video = $('live-video');
  if (capturedFrames >= MAX_FRAMES) { toast('Max frames reached'); return; }

  const idx = capturedFrames + 1;
  const canvas = $(`frame-${idx}`);
  if (!canvas) return;

  const w = video?.videoWidth || 640;
  const h = video?.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (video?.videoWidth) ctx.drawImage(video, 0, 0, w, h);
  else {
    ctx.fillStyle = '#16161c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a78bfa';
    ctx.font = '16px IBM Plex Mono, monospace';
    ctx.fillText(`FRAME ${idx}  ${new Date().toLocaleTimeString()}`, 16, 36);
    ctx.fillStyle = '#9898a8';
    ctx.font = '12px IBM Plex Mono, monospace';
    ctx.fillText('no camera — placeholder', 16, 58);
  }

  state.frameCanvases.push(canvas.toDataURL('image/jpeg', 0.72));
  capturedFrames += 1;
  state.totalFrames += 1;
  updateFrameUI();
  toast(`Frame ${idx} captured`);
};

export const runSweep = async () => {
  const btn = $('btn-sweep');
  const status = $('sweep-status');
  if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ac = state.audioCtx;
  if (ac.state === 'suspended') await ac.resume();

  btn.disabled = true;
  status.textContent = 'sweeping 20 Hz → 20 kHz…';

  const duration = 3;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const analyser = ac.createAnalyser();
  analyser.fftSize = 256;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(20, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20000, ac.currentTime + duration);
  gain.gain.setValueAtTime(0.35, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + duration);
  osc.connect(gain);
  gain.connect(analyser);
  analyser.connect(ac.destination);

  if (state.micStream) {
    const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
    state.mediaRecorder = mime
      ? new MediaRecorder(state.micStream, { mimeType: mime })
      : new MediaRecorder(state.micStream);
    state.audioChunks = [];
    state.mediaRecorder.ondataavailable = (e) => { if (e.data.size) state.audioChunks.push(e.data); };
    state.mediaRecorder.start();
  }

  const viz = $('sweep-viz');
  const vCtx = viz.getContext('2d');
  const dpr = devicePixelRatio || 1;
  viz.width = viz.clientWidth * dpr;
  viz.height = viz.clientHeight * dpr;
  vCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = viz.clientWidth;
  const H = viz.clientHeight;
  const dataArr = new Uint8Array(analyser.frequencyBinCount);
  const startT = performance.now();
  let rafId;

  const draw = () => {
    rafId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArr);
    const elapsed = (performance.now() - startT) / 1000;
    vCtx.fillStyle = '#141418';
    vCtx.fillRect(0, 0, W, H);
    const barW = W / dataArr.length;
    dataArr.forEach((raw, i) => {
      const v = raw / 255;
      vCtx.fillStyle = `hsl(${260 + v * 40},70%,${40 + v * 30}%)`;
      vCtx.fillRect(i * barW, H - v * H, barW - 1, v * H);
    });
    vCtx.strokeStyle = '#a78bfa';
    vCtx.beginPath();
    vCtx.moveTo((elapsed / duration) * W, 0);
    vCtx.lineTo((elapsed / duration) * W, H);
    vCtx.stroke();
    if (elapsed >= duration) cancelAnimationFrame(rafId);
  };
  draw();

  osc.start();
  osc.stop(ac.currentTime + duration);
  osc.onended = () => {
    cancelAnimationFrame(rafId);
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
    state.sweepDone = true;
    state.totalSweeps += 1;
    status.textContent = 'sweep complete';
    btn.disabled = false;
    toast('Acoustic sweep recorded');
  };
};

export const stopCamera = () => {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  const v = $('live-video');
  if (v) v.srcObject = null;
};

export const finishCapture = () => {
  if (capturedFrames < 1) { toast('Snap at least one frame'); return null; }
  state.lastCapture = new Date().toISOString();
  state.sessions += 1;
  const world = {
    name: `Room ${state.sessions}`,
    date: state.lastCapture,
    frames: capturedFrames,
    sweepDone: state.sweepDone,
    orientation: state.orientation,
    modelId: 'butterfly',
  };
  state.worlds.unshift(world);
  state.session = world;
  persist();
  stopCamera();
  setPendingFrames([...state.frameCanvases]);
  return world;
};

export const exportSession = () => {
  const s = state.session;
  if (!s) { toast('No session to export'); return; }
  const blob = new Blob([JSON.stringify({
    version: '0.2',
    session: s,
    counters: { sessions: state.sessions, frames: state.totalFrames, sweeps: state.totalSweeps },
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `room-scanic-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('JSON exported');
};

export const buildSummary = () => {
  const s = state.session;
  if (!s) return;
  const meta = {
    Session: `#${state.sessions}`,
    World: s.name,
    Frames: s.frames,
    Sweep: s.sweepDone ? 'yes' : 'no',
    Date: new Date(s.date).toLocaleString(),
    Orientation: s.orientation ? `α ${s.orientation.alpha?.toFixed(0) ?? '?'}` : 'n/a',
  };
  $('summary-kv').innerHTML = Object.entries(meta).map(([k, v]) =>
    `<div class="kv-cell"><div class="label">${k}</div><div class="value">${String(v)}</div></div>`
  ).join('');

  const framesDiv = $('summary-frames');
  framesDiv.innerHTML = '';
  state.frameCanvases.forEach((src, i) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Frame ${i + 1}`;
    framesDiv.appendChild(img);
  });
  $('summary-json').textContent = JSON.stringify({ version: '0.2', session: s }, null, 2);
};
