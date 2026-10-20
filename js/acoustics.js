/** Farina ESS → IR → T20/T30. Device+room, not lab-grade. */

export const SWEEP = { f0: 20, f1: 16000, T: 3, tail: 1.8, gain: 0.28, fade: 0.02 };

export const nextPow2 = (n) => 1 << Math.ceil(Math.log2(Math.max(1, n)));

export const fft = (re, im, invert = false) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((invert ? 2 : -2) * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nWRe;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < n; i += 1) { re[i] /= n; im[i] /= n; }
  }
};

export const synthesizeSweep = (sr, { f0, f1, T, fade } = SWEEP) => {
  const n = Math.floor(T * sr);
  const R = Math.log(f1 / f0);
  const sweep = new Float32Array(n);
  const inv = new Float32Array(n);
  const fadeN = Math.max(1, Math.floor(fade * sr));
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const phase = ((2 * Math.PI * f0 * T) / R) * (Math.exp((t * R) / T) - 1);
    let s = Math.sin(phase);
    if (i < fadeN) s *= i / fadeN;
    if (i > n - fadeN) s *= (n - 1 - i) / fadeN;
    sweep[i] = s;
  }
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    inv[i] = sweep[n - 1 - i] * Math.exp((-t * R) / T);
  }
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(inv[i]));
  const g = peak > 0 ? 1 / peak : 1;
  for (let i = 0; i < n; i += 1) inv[i] *= g;
  return { sweep, inv, sr, n, R };
};

export const playBuffer = (ac, samples, gain = SWEEP.gain) => {
  const buf = ac.createBuffer(1, samples.length, ac.sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  g.gain.value = gain;
  src.connect(g);
  g.connect(ac.destination);
  src.start();
  return new Promise((resolve) => { src.onended = resolve; });
};

const convolve = (a, b) => {
  const n = nextPow2(a.length + b.length);
  const aRe = new Float32Array(n);
  const aIm = new Float32Array(n);
  const bRe = new Float32Array(n);
  const bIm = new Float32Array(n);
  aRe.set(a); bRe.set(b);
  fft(aRe, aIm, false); fft(bRe, bIm, false);
  for (let i = 0; i < n; i += 1) {
    const re = aRe[i] * bRe[i] - aIm[i] * bIm[i];
    const im = aRe[i] * bIm[i] + aIm[i] * bRe[i];
    aRe[i] = re; aIm[i] = im;
  }
  fft(aRe, aIm, true);
  return aRe;
};

const peakIndex = (x, from, to) => {
  let best = from; let v = 0;
  const end = Math.min(to, x.length);
  for (let i = from; i < end; i += 1) {
    const a = Math.abs(x[i]);
    if (a > v) { v = a; best = i; }
  }
  return { index: best, amp: v };
};

const firstCrossing = (db, start, target) => {
  for (let i = start; i < db.length; i += 1) if (db[i] <= target) return i;
  return -1;
};

export const analyzeIR = (ir, sr) => {
  const { index: peak, amp } = peakIndex(ir, 0, ir.length);
  const keep = Math.min(ir.length - peak, Math.floor(sr * 1.6));
  const slice = ir.subarray(peak, peak + Math.max(keep, 1));
  const energy = new Float32Array(slice.length);
  for (let i = 0; i < slice.length; i += 1) energy[i] = slice[i] * slice[i];
  const sch = new Float32Array(energy.length);
  let acc = 0;
  for (let i = energy.length - 1; i >= 0; i -= 1) { acc += energy[i]; sch[i] = acc; }
  const E0 = sch[0] > 0 ? sch[0] : 1e-20;
  const db = new Float32Array(sch.length);
  for (let i = 0; i < sch.length; i += 1) db[i] = 10 * Math.log10(sch[i] / E0);
  const i5 = firstCrossing(db, 0, -5);
  const i25 = firstCrossing(db, Math.max(i5, 0), -25);
  const i35 = firstCrossing(db, Math.max(i5, 0), -35);
  const t20 = i5 >= 0 && i25 >= 0 ? (2 * (i25 - i5)) / sr : null;
  const t30 = i5 >= 0 && i35 >= 0 ? (2 * (i35 - i5)) / sr : null;
  const i0 = firstCrossing(db, 0, -1);
  const i10 = firstCrossing(db, Math.max(i0, 0), -10);
  const edt = i0 >= 0 && i10 >= 0 ? (6 * (i10 - i0)) / sr : null;
  const noise = peakIndex(ir, Math.min(ir.length - 1, peak + Math.floor(sr * 0.8)), ir.length).amp;
  const snr = amp > 0 && noise > 0 ? 20 * Math.log10(amp / noise) : null;
  const reliable = t20 != null && t20 > 0.05 && t20 < 4 && (snr == null || snr > 8);
  return {
    peak, peakAmp: amp, t20, t30, edt, snrDb: snr, reliable, sr,
    db: Array.from(db.subarray(0, Math.min(db.length, Math.floor(sr * 1.2)))),
    irPreview: Array.from(slice.subarray(0, Math.min(slice.length, Math.floor(sr * 0.25)))),
  };
};

export const deconvolve = (recorded, inv) => convolve(recorded, inv);

export const encodeWav = (samples, sr) => {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const w = (off, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  w(36, 'data'); view.setUint32(40, n * 2, true);
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  let o = 44;
  for (let i = 0; i < n; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] * g));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
};

export const drawDecay = (canvas, db) => {
  if (!canvas || !db?.length) return;
  const dpr = devicePixelRatio || 1;
  const W = canvas.clientWidth || 300;
  const H = canvas.clientHeight || 72;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#141418'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2c2c34'; ctx.beginPath();
  [-5, -25, -35].forEach((line) => {
    const y = ((0 - line) / 60) * H;
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  });
  ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.4;
  db.forEach((v, i) => {
    const x = (i / (db.length - 1)) * W;
    const y = ((0 - Math.max(-60, v)) / 60) * H;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
};

export const fmtSec = (v) => (v == null || Number.isNaN(v) ? '—' : `${v.toFixed(2)} s`);
