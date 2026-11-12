// Liga o simulador ao HyperFrames: o palco é uma "frame source" e cada quadro é refeito pela física.
// O quadro N sempre sai igual: a cena recomeça do zero (pres.go) e avança quadro a quadro até N.
// Com ?audio, percorre o vídeo inteiro num OfflineAudioContext e manda o WAV para video/tools/som.py.
import { TIMELINE as TL } from './timeline.js';

const FPS = TL.fps;
const qs = new URLSearchParams(location.search);
const AUDIO = qs.has('audio');
const waitFor = (f) => new Promise((r) => { const k = () => (f() ? r() : setTimeout(k, 20)); k(); });

// tempo do roteiro (s) para o tempo local da cena no vídeo (a)
function scriptAt(sc, a) {
  const W = sc.warp.length && sc.warp[0][0] > 0 ? [[0, 0], ...sc.warp] : sc.warp;
  if (!W.length) return a;
  for (let i = 0; i < W.length - 1; i++) {
    const [a0, s0] = W[i], [a1, s1] = W[i + 1];
    if (a > a1) continue;
    if (s1 <= s0) return s0;
    if (a1 - a0 >= s1 - s0) return Math.min(s0 + (a - a0), s1 - 0.001);
    return s0 + ((a - a0) * (s1 - s0)) / (a1 - a0);
  }
  const [al, sl] = W[W.length - 1];
  return sl + Math.max(0, a - al);
}

const cur = { k: -1, f: -1, s: 0 };
const sceneAt = (f) => { let k = 0; TL.scenes.forEach((sc, i) => { if (Math.round(sc.start * FPS) <= f) k = i; }); return k; };

function begin(k) {
  const sc = TL.scenes[k], sim = window.sim;
  if (!sim.pres.active) sim.pres.start(sc.scene); else sim.pres.go(sc.scene);
  cur.k = k; cur.f = Math.round(sc.start * FPS); cur.s = 0;
}

function renderFrame(t) {
  const f = Math.max(0, Math.round(t * FPS));
  const k = sceneAt(f);
  if (k !== cur.k || f < cur.f) begin(k);
  const sc = TL.scenes[k], f0 = Math.round(sc.start * FPS);
  while (cur.f < f) {
    cur.f++;
    const s = scriptAt(sc, (cur.f - f0) / FPS);
    const ds = Math.max(0, s - cur.s);
    cur.s = s;
    window.__clock = cur.f / FPS;
    window.sim.tick(1 / FPS, ds);
  }
}

const ready = waitFor(() => window.sim && window.sim.pres).then(() => document.fonts && document.fonts.ready);

if (AUDIO) {
  ready.then(async () => {
    const sr = 48000, n = Math.ceil(TL.total * sr);
    const ctx = new OfflineAudioContext(1, n, sr);
    const snd = window.sim.sound;
    await snd.start(ctx);   // espera o sintetizador (AudioWorklet) carregar antes do primeiro quadro
    snd.clock = () => window.__clock || 0;
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99;font:28px sans-serif;color:#fff;background:#000a;padding:10px 16px';
    document.body.appendChild(msg);
    const N = Math.round(TL.total * FPS);
    for (let f = 0; f <= N; f++) {
      renderFrame(f / FPS);
      if (f % 300 === 0) { msg.textContent = `som: ${Math.round((100 * f) / N)}%`; await new Promise((r) => setTimeout(r, 0)); }
    }
    msg.textContent = 'renderizando o som…';
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const wav = new DataView(new ArrayBuffer(44 + d.length * 2));
    const w = (o, s) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); wav.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVEfmt '); wav.setUint32(16, 16, true);
    wav.setUint16(20, 1, true); wav.setUint16(22, 1, true); wav.setUint32(24, sr, true); wav.setUint32(28, sr * 2, true);
    wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); w(36, 'data'); wav.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    await fetch('/som-maquina.wav', { method: 'POST', body: wav.buffer });
    msg.textContent = `pronto · pico ${peak.toFixed(2)}`;
    window.__somPronto = peak;
  });
} else if (window.__hyperframes) {
  window.__hyperframes.registerFrameSource({
    element: document.getElementById('stage'),
    ready,
    render: (t) => renderFrame(t),
  });
}
window.__video = { render: renderFrame, scriptAt, TL };
