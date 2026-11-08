// Gravação offline do som (sem tocar): roda física + som quadro a quadro num OfflineAudioContext.
// Uso no console: const m = await import('./js/audio/offline.js'); await m.record('teste', m.SCRIPTS.rev)
// O WAV vai por POST para tools/serve.py (tools/out/<nome>.wav). Também serve para o vídeo, no futuro.
import { DEFAULTS_BY } from '../config.js';
import { createState, step, shift, kick } from '../sim/engine.js';
import { Sound } from './sound.js';

const FPS = 60, PHYS = 1 / 240;

// roteiros: (t, st, P, ctl) → escreve comandos. ctl.once(chave, fn) executa uma vez.
export const SCRIPTS = {
  // lenta → meia aceleração → plena até o corte → solta → blips
  rev: { sec: 12, prep: { warm: true }, fn: (t, st, P, c) => {
    c.grip = t < 2 ? 0 : t < 4 ? 0.3 : t < 6.5 ? 1 : t < 8.5 ? 0 : (t % 1 < 0.25 ? 1 : 0);
  } },
  idle: { sec: 4, prep: { warm: true }, fn: (t, st, P, c) => { c.grip = 0; } },
  start: { sec: 6, prep: { warm: false, off: true }, fn: (t, st, P, c) => {
    c.once('k', () => { st.key = true; });
    c.start = t > 2.3 && t < 3.3;
    c.grip = 0;
  } },
  // partida longa: gira ~1,5 s antes de pegar (a bomba ainda está escorvando)
  crank: { sec: 5, prep: { warm: false, off: true }, fn: (t, st, P, c) => {
    c.once('k', () => { st.key = true; });
    c.start = t > 0.6 && t < 2.6;
    c.grip = 0;
  } },
  // pedal (CG): fria com afogador, uma pedalada a cada 0,8 s até pegar
  kick: { sec: 6, prep: { warm: false, off: true }, fn: (t, st, P, c) => {
    c.once('k', () => { st.key = true; st.choke = true; });
    if (!st.running && t > 0.5 && t - (c.lastKick || 0) > 0.8) { c.lastKick = t; kick(st, P); }
    c.grip = 0;
  } },
  // pista: 1ª, sai, sobe marchas com quickshifter até a 4ª, solta
  track: { sec: 16, prep: { warm: true }, fn: (t, st, P, c) => {
    c.once('cl', () => { c.clutch = 1; });
    if (t > 0.4) c.once('g1', () => shift(st, P, -1));
    if (t > 0.8) c.clutch = 0;
    c.grip = t < 0.8 ? 0 : t < 1.6 ? 0.45 : t < 12 ? 1 : 0;
    c.brake = t > 13 ? 1 : 0;
    if (st.rpm > 0.96 * P.limit && st.gear < 5 && st.cut.qs <= 0 && t < 12 && t - (c.lastUp || 0) > 0.6) c.once('up' + st.gear, () => {
      c.lastUp = t;
      if (!P.qs) { st.input.clutch = 1; c.clutchKick = 2; }
      shift(st, P, 1);
    });
  } },
};

export async function record(name, script, opts = {}) {
  const sr = opts.sr || 48000;
  const sec = script.sec;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * sec), sr);
  const P = { ...DEFAULTS_BY[opts.engine || 'i4'], ...(opts.P || {}) };
  const st = createState(P, script.prep.off ? {} : { key: true, wasKey: true, primed: true, running: true, omega: P.idle / 9.549 });
  if (script.prep.warm) { st.temp.coolant = 88; st.temp.oil = 90; st.temp.egt = 450; }
  const snd = new Sound();
  if (opts.listen) snd.listen = opts.listen;
  let now = 0;
  snd.clock = () => now;
  await snd.start(ctx);
  const c = { grip: 0, clutch: 0, brake: 0, start: false, done: {}, once(k, f) { if (!this.done[k]) { this.done[k] = 1; f(); } } };
  let clutch = 0, acc = 0;
  const frames = Math.floor(sec * FPS);
  const log = [];
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    ctx.suspend(t).then(() => {
      now = t;
      script.fn(t, st, P, c);
      if (c.clutchKick > 0) { c.clutchKick--; clutch = 1; }
      clutch = c.clutch > clutch ? Math.min(c.clutch, clutch + 1 / FPS / 0.08) : Math.max(c.clutch, clutch - 1 / FPS / 0.7);
      st.input.grip = c.grip; st.input.clutch = clutch; st.input.brake = c.brake; st.input.start = c.start;
      acc += 1 / FPS;
      while (acc >= PHYS) { step(st, P, PHYS); acc -= PHYS; }
      snd.update(st, P, 1 / FPS);
      if (f % 6 === 0) log.push([t, Math.round(st.rpm), st.gear, Math.round(st.v * 3.6)]);
      ctx.resume();
    });
  }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  // análise: RMS e pico a cada 0,25 s
  const seg = [];
  const n = Math.floor(sr * 0.25);
  for (let i = 0; i + n <= L.length; i += n) {
    let s = 0, pk = 0;
    for (let j = i; j < i + n; j++) { const v = (L[j] + R[j]) / 2; s += v * v; pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j])); }
    seg.push([+(i / sr).toFixed(2), +Math.sqrt(s / n).toFixed(3), +pk.toFixed(2)]);
  }
  if (name) await fetch(`/save?name=${encodeURIComponent(name)}.wav`, { method: 'POST', body: wav(L, R, sr) });
  return { seg, log };
}

function wav(L, R, sr) {
  const n = L.length, b = new ArrayBuffer(44 + n * 4), d = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 2, true); d.setUint32(24, sr, true);
  d.setUint32(28, sr * 4, true); d.setUint16(32, 4, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    d.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); o += 2;
    d.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 2;
  }
  return b;
}
