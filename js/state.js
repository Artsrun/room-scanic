const MAX_WORLDS = 8;
const KEYS = {
  worlds: 'rs_worlds',
  sessions: 'rs_sessions',
  frames: 'rs_frames',
  sweeps: 'rs_sweeps',
  last: 'rs_last',
};

const loadJson = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k) || '') || fallback; }
  catch { return fallback; }
};

export const state = {
  worlds: loadJson(KEYS.worlds, []).slice(0, MAX_WORLDS),
  sessions: Number.parseInt(localStorage.getItem(KEYS.sessions) || '0', 10) || 0,
  totalFrames: Number.parseInt(localStorage.getItem(KEYS.frames) || '0', 10) || 0,
  totalSweeps: Number.parseInt(localStorage.getItem(KEYS.sweeps) || '0', 10) || 0,
  lastCapture: localStorage.getItem(KEYS.last),
  session: null,
  stream: null,
  micStream: null,
  orientation: null,
  frameCanvases: [],
  sweepDone: false,
  mediaRecorder: null,
  audioChunks: [],
  audioCtx: null,
  perms: { camera: false, mic: false, motion: false },
  pendingSplat: { kind: 'spark', id: 'butterfly' },
};

export const persist = () => {
  state.worlds = state.worlds.slice(0, MAX_WORLDS);
  localStorage.setItem(KEYS.sessions, String(state.sessions));
  localStorage.setItem(KEYS.frames, String(state.totalFrames));
  localStorage.setItem(KEYS.sweeps, String(state.totalSweeps));
  if (state.lastCapture) localStorage.setItem(KEYS.last, state.lastCapture);
  const slim = state.worlds.map(({ name, date, frames, sweepDone, modelId }) => ({
    name, date, frames, sweepDone, modelId: modelId || 'butterfly',
  }));
  localStorage.setItem(KEYS.worlds, JSON.stringify(slim));
};

export const setPendingSpark = (id) => {
  state.pendingSplat = { kind: 'spark', id };
};

export const setPendingFrames = (urls) => {
  state.pendingSplat = { kind: 'frames', urls };
};
