import { state, persist, setPendingFrames } from './state.js';
import { $, toast, setBadge } from './ui.js';
import {
  SWEEP, synthesizeSweep, playBuffer, deconvolve, analyzeIR,
  encodeWav, drawDecay, fmtSec,
} from './acoustics.js';

export const MAX_FRAMES = 3;
export let capturedFrames = 0;

export const resetCapture = () => {
  capturedFrames = 0;
  state.frameCanvases = [];
  state.sweepDone = false;
  state.acoustic = null;
  state.irWav = null;
  state.audioChunks = [];
  state.orientationTrail = [];
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
    const trail = state.orientationTrail || (state.orientationTrail = []);
    if (trail.length > 400) trail.shift();
    trail.push({ t: Date.now(), a: e.alpha, b: e.beta, g: e.gamma });
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
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (video?.videoWidth) ctx.drawImage(video, 0, 0, w, h);
  else {
    ctx.fillStyle = '#16161c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a78bfa'; ctx.font = '16px IBM Plex Mono, monospace';
    ctx.fillText(`FRAME ${idx}  ${new Date().toLocaleTimeString()}`, 16, 36);
  }
  state.frameCanvases.push(canvas.toDataURL('image/jpeg', 0.72));
  capturedFrames += 1; state.totalFrames += 1;
  updateFrameUI(); toast(`Frame ${idx} captured`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recordMic = async (ms) => {
  if (!state.micStream) return null;
  const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = mime ? new MediaRecorder(state.micStream, { mimeType: mime }) : new MediaRecorder(state.micStream);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(250);
  await sleep(ms);
  if (rec.state !== 'inactive') rec.stop();
  await new Promise((resolve) => { rec.onstop = resolve; });
  return new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
};

const decodeBlob = async (ac, blob) => {
  const raw = await blob.arrayBuffer();
  const buf = await ac.decodeAudioData(raw.slice(0));
  return { samples: Float32Array.from(buf.getChannelData(0)), sr: buf.sampleRate };
};

export const runSweep = async () => {
  const btn = $('btn-sweep');
  const status = $('sweep-status');
  if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ac = state.audioCtx;
  if (ac.state === 'suspended') await ac.resume();
  btn.disabled = true;
  status.textContent = `ESS ${SWEEP.f0}–${SWEEP.f1} Hz · ${SWEEP.T}s + ${SWEEP.tail}s tail`;
  const { sweep } = synthesizeSweep(ac.sampleRate);
  const recMs = Math.round((SWEEP.T + SWEEP.tail + 0.25) * 1000);
  const recPromise = recordMic(recMs);
  await sleep(180);
  status.textContent = 'playing sweep — keep still';
  await playBuffer(ac, sweep, SWEEP.gain);
  status.textContent = 'recording tail…';
  const blob = await recPromise;
  state.sweepDone = true; state.totalSweeps += 1;
  if (!blob || blob.size < 64) {
    status.textContent = 'sweep played — no mic take (grant mic for IR / RT60)';
    btn.disabled = false; toast('Need microphone for IR'); return;
  }
  status.textContent = 'deconvolving…';
  try {
    const rec = await decodeBlob(ac, blob);
    const { inv } = synthesizeSweep(rec.sr);
    const ir = deconvolve(rec.samples, inv);
    const report = analyzeIR(ir, rec.sr);
    state.acoustic = {
      f0: SWEEP.f0, f1: SWEEP.f1, T: SWEEP.T, tail: SWEEP.tail,
      method: 'Farina ESS', note: 'device + room IR, not lab',
      t20: report.t20, t30: report.t30, edt: report.edt,
      snrDb: report.snrDb, reliable: report.reliable, sr: rec.sr,
    };
    const hold = Math.min(ir.length - report.peak, Math.floor(rec.sr * 1.6));
    state.irWav = encodeWav(ir.subarray(report.peak, report.peak + hold), rec.sr);
    drawDecay($('sweep-viz'), report.db);
    const tag = report.reliable ? 'ok' : 'rough';
    status.textContent = `IR ${tag} · T20 ${fmtSec(report.t20)} · T30 ${fmtSec(report.t30)} · EDT ${fmtSec(report.edt)}`;
    toast(report.reliable ? `T20 ${fmtSec(report.t20)}` : 'IR weak — closer to speaker / quieter room');
  } catch (err) {
    console.warn(err);
    status.textContent = `sweep saved, IR failed — ${err.message || 'decode'}`;
    toast('Could not decode mic take');
  }
  btn.disabled = false;
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
    name: `Room ${state.sessions}`, date: state.lastCapture, frames: capturedFrames,
    sweepDone: state.sweepDone, orientation: state.orientation,
    trail: (state.orientationTrail || []).slice(-80), modelId: 'butterfly',
    t20: state.acoustic?.t20 ?? null, t30: state.acoustic?.t30 ?? null,
    edt: state.acoustic?.edt ?? null, reliable: state.acoustic?.reliable ?? null,
    acoustic: state.acoustic,
  };
  state.worlds.unshift(world); state.session = world; persist();
  stopCamera(); setPendingFrames([...state.frameCanvases]); return world;
};

const downloadBlob = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
};

export const exportSession = () => {
  const s = state.session;
  if (!s) { toast('No session to export'); return; }
  const stamp = Date.now();
  downloadBlob(new Blob([JSON.stringify({
    version: '0.3', session: s, acoustic: state.acoustic,
    counters: { sessions: state.sessions, frames: state.totalFrames, sweeps: state.totalSweeps },
  }, null, 2)], { type: 'application/json' }), `room-scanic-${stamp}.json`);
  if (state.irWav) downloadBlob(state.irWav, `room-scanic-${stamp}-ir.wav`);
  toast(state.irWav ? 'JSON + IR wav' : 'JSON exported');
};

export const buildSummary = () => {
  const s = state.session;
  if (!s) return;
  const meta = {
    Session: `#${state.sessions}`, World: s.name, Frames: s.frames,
    Sweep: s.sweepDone ? 'yes' : 'no', T20: fmtSec(s.t20), T30: fmtSec(s.t30), EDT: fmtSec(s.edt),
    IR: s.reliable ? 'usable' : (s.acoustic ? 'rough' : 'none'),
    Date: new Date(s.date).toLocaleString(),
    Orientation: s.orientation ? `α ${s.orientation.alpha?.toFixed(0) ?? '?'}` : 'n/a',
  };
  $('summary-kv').innerHTML = Object.entries(meta).map(([k, v]) =>
    `<div class="kv-cell"><div class="label">${k}</div><div class="value">${String(v)}</div></div>`
  ).join('');
  const framesDiv = $('summary-frames');
  framesDiv.innerHTML = '';
  state.frameCanvases.forEach((src, i) => {
    const img = document.createElement('img'); img.src = src; img.alt = `Frame ${i + 1}`;
    framesDiv.appendChild(img);
  });
  $('summary-json').textContent = JSON.stringify({ version: '0.3', session: s, acoustic: state.acoustic }, null, 2);
};
