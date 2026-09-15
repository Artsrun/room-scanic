import { SPARK_MODELS } from './catalog.js';
import { state, setPendingSpark } from './state.js';
import { $, toast, escHtml } from './ui.js';
import {
  grantAll, ensurePreview, snapFrame, runSweep, finishCapture,
  exportSession, buildSummary, resetCapture, updateFrameUI,
} from './capture.js';
import { initSplat, disposeSplat, resetSplatCamera, toggleAutoRotate, loadSplatSource } from './splat.js';

const screens = {};
document.querySelectorAll('.screen').forEach((el) => {
  screens[el.id.replace('screen-', '')] = el;
});

export const navigate = async (name) => {
  const current = document.querySelector('.screen.active')?.id?.replace('screen-', '');
  if (current === 'splat' && name !== 'splat') disposeSplat();

  Object.values(screens).forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  screens[name]?.classList.add('active');
  document.querySelector(`.tab[data-screen="${name}"]`)?.classList.add('active');

  if (name === 'home') refreshHome();
  if (name === 'library') renderLibrary();
  if (name === 'capture') { updateFrameUI(); await ensurePreview(); }
  if (name === 'summary') buildSummary();
  if (name === 'splat') await initSplat();
};

const refreshHome = () => {
  $('stat-sessions').textContent = state.sessions;
  $('stat-frames').textContent = state.totalFrames;
  $('stat-sweeps').textContent = state.totalSweeps;
  $('stat-last').textContent = state.lastCapture
    ? new Date(state.lastCapture).toLocaleDateString()
    : '—';

  const list = $('worlds-list');
  const empty = $('worlds-empty');
  list.innerHTML = '';
  if (!state.worlds.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  state.worlds.forEach((w) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'world-item';
    item.innerHTML = `
      <div class="world-thumb">${escHtml(w.name.slice(0, 1))}</div>
      <div class="world-info">
        <div class="world-name">${escHtml(w.name)}</div>
        <div class="world-meta">${w.frames} frames · ${new Date(w.date).toLocaleDateString()}${w.sweepDone ? ' · sweep' : ''}</div>
      </div>
      <span class="badge badge-ok">open</span>`;
    item.addEventListener('click', () => {
      setPendingSpark(w.modelId || 'butterfly');
      navigate('splat');
    });
    list.appendChild(item);
  });
};

const renderLibrary = () => {
  const grid = $('library-grid');
  if (grid.dataset.ready === '1') return;
  grid.dataset.ready = '1';
  grid.innerHTML = SPARK_MODELS.map((m) => `
    <button type="button" class="model-card" data-id="${m.id}">
      <div class="model-name">${escHtml(m.name)}</div>
      <div class="model-meta"><span class="badge badge-warn">${m.tag}</span> ${m.mb} MB · ${m.file}</div>
    </button>`).join('');
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    setPendingSpark(card.dataset.id);
    navigate('splat');
  });
};

const renderSplatPicker = () => {
  const row = $('splat-picker');
  row.innerHTML = SPARK_MODELS.map((m) =>
    `<button type="button" class="chip" data-id="${m.id}">${escHtml(m.name)}</button>`
  ).join('');
  row.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-id]');
    if (!chip) return;
    setPendingSpark(chip.dataset.id);
    try { await loadSplatSource(); }
    catch (err) { toast(err.message || 'Load failed'); }
  });
};

$('btn-new-scan').addEventListener('click', () => {
  resetCapture();
  navigate(state.perms.camera ? 'capture' : 'perms');
});
$('btn-grant-perms').addEventListener('click', async () => {
  const btn = $('btn-grant-perms');
  btn.disabled = true;
  btn.textContent = 'Requesting…';
  const ok = await grantAll();
  btn.disabled = false;
  btn.textContent = 'Grant Permissions';
  if (ok) {
    toast('Ready to capture');
    setTimeout(() => navigate('capture'), 400);
  } else toast('No camera / mic — you can still snap placeholders');
});
$('btn-skip-perms').addEventListener('click', () => navigate('capture'));
$('btn-snap').addEventListener('click', snapFrame);
$('btn-sweep').addEventListener('click', runSweep);
$('btn-finish').addEventListener('click', () => {
  if (!finishCapture()) return;
  $('btn-export').hidden = false;
  navigate('summary');
});
$('btn-view-splat').addEventListener('click', () => navigate('splat'));
$('btn-done').addEventListener('click', () => { resetCapture(); navigate('home'); });
$('btn-export').addEventListener('click', exportSession);
$('btn-splat-reset').addEventListener('click', resetSplatCamera);
$('btn-splat-auto').addEventListener('click', toggleAutoRotate);
$('btn-splat-back').addEventListener('click', () => navigate('home'));
$('btn-open-library').addEventListener('click', () => navigate('library'));

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => navigate(t.dataset.screen));
});

renderSplatPicker();
refreshHome();
navigate('home');
