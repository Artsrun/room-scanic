export const $ = (id) => document.getElementById(id);

export const escHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

let toastTimer;
export const toast = (msg, dur = 2400) => {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
};

export const setBadge = (id, value) => {
  const el = $(id);
  if (!el) return;
  const kind = value === 'granted' || value === 'live' || value === 'complete'
    ? 'ok'
    : value === 'denied' || value === 'error'
      ? 'err'
      : 'warn';
  el.className = `badge badge-${kind}`;
  el.textContent = value;
};
