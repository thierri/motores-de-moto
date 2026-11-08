// Partes do escapamento comuns aos dois motores: desenho do silencioso (conforme o abafamento) e o quadro
// com o estado do escapamento e o ruído estimado.
import { el, txt, attr, pColor, fmt } from './svg.js';
import { exhaustOpen, profile } from '../config.js';

// Desenha o silencioso começando em (x0, y). Abafamento maior = lata maior e mais fechada.
// Sem silencioso: só o tubo reto. Devolve a ponta (onde saem as ondas de som) e a válvula, se houver.
export function drawMuffler(g, P, x0, y, withFlap, hk = 1) {
  g.innerHTML = '';
  const b = P.baffle ?? 1;
  if (P.muffler === false) {
    el('rect', { x: x0, y: y - 6, width: 70, height: 12, rx: 3, fill: '#5b6d82', stroke: '#c3cad4', 'stroke-width': 1 }, g);
    return { tail: x0 + 70, flap: null };
  }
  const len = 70 + 110 * b, h = (22 + 22 * b) * hk;
  el('path', { d: `M${x0} ${y - h / 2} H${x0 + len - 14} Q${x0 + len} ${y - h / 2} ${x0 + len} ${y - h / 2 + 10} V${y + h / 2 - 10} Q${x0 + len} ${y + h / 2} ${x0 + len - 14} ${y + h / 2} H${x0} Z`,
    fill: '#2a3644', stroke: '#c3cad4', 'stroke-width': 1.2 }, g);
  // miolo perfurado: mais câmaras = mais abafado
  const n = Math.round(1 + 4 * b);
  for (let k = 1; k <= n; k++) {
    const x = x0 + (k / (n + 1)) * len;
    el('line', { x1: x, y1: y - h / 2 + 3, x2: x, y2: y + h / 2 - 3, stroke: '#5b6d82', 'stroke-width': 1, 'stroke-dasharray': '3 2' }, g);
  }
  el('rect', { x: x0 + 6, y: y - 5, width: len - 12, height: 10, rx: 4, fill: 'none', stroke: '#8a98a8', 'stroke-width': 0.8, 'stroke-dasharray': '2 3' }, g);
  let flap = null;
  if (withFlap) flap = el('line', { x1: x0 + len - 22, y1: y - h / 2 + 5, x2: x0 + len - 22, y2: y + h / 2 - 5, stroke: '#f2b632', 'stroke-width': 2.4 }, g);
  return { tail: x0 + len, flap, flapX: x0 + len - 22 };
}

export const mufKey = (P) => `${P.muffler}${(P.baffle ?? 1).toFixed(2)}`;

// ruído estimado a uns 7 m (ordem de grandeza, para comparar as opções)
export function noiseDb(st, P) {
  const E = profile(P);
  if (!(st.running && !st.broken) && st.rpm < 50) return 0;
  const o = exhaustOpen(P);
  const load = Math.max(0, Math.min(1, st.pr)) * (st.comb > 0 ? 1 : 0.5);
  let db = 60 + 18 * load + 16 * Math.min(1.1, st.rpm / E.limit) + 14 * o + (P.muffler === false ? 5 : 0) + (E.cyl === 2 ? 4 : 0);
  if (E.cyl === 4 && P.muffler !== false && o < 0.3) db -= 4 * (1 - flapOpen(st, P, E));
  return db;
}
export function flapOpen(st, P, E) {
  if (P.flap === 'open') return 1;
  if (P.flap === 'closed') return 0;
  return st.rpm > E.snd.flapRpm && st.tps > 0.3 ? 1 : 0;
}

// quadro de informação do escapamento
export class ExhaustInfo {
  constructor(g, x, y, w) {
    this.x = x; this.y = y; this.w = w;
    const b = el('g', { 'data-comp': 'exhaustSys', 'clip-path': 'url(#viewClip)' }, g);
    el('rect', { x, y, width: w, height: 214, rx: 12, fill: '#0d151e', stroke: '#263446' }, b);
    txt(b, x + 14, y + 26, 'Ruído estimado', { 'font-size': 13, fill: '#8da0b6' });
    this.db = txt(b, x + 14, y + 66, '—', { 'font-size': 36, 'font-weight': 800, fill: '#fff', 'font-family': 'var(--mono)' });
    txt(b, x + w - 14, y + 66, 'dB', { 'font-size': 14, fill: '#8da0b6', 'text-anchor': 'end' });
    el('rect', { x: x + 14, y: y + 78, width: w - 28, height: 10, rx: 5, fill: '#1a2430' }, b);
    this.bar = el('rect', { x: x + 14, y: y + 78, width: 0, height: 10, rx: 5 }, b);
    this.lines = [0, 1, 2, 3].map((k) => txt(b, x + 14, y + 114 + k * 24, '', { 'font-size': 13, fill: '#c2cfdc' }));
    this.v = 0;
  }

  update(st, P, dt) {
    const E = profile(P);
    const d = noiseDb(st, P);
    this.v += (d - this.v) * (1 - Math.exp(-dt / 0.25));
    this.db.textContent = d > 0 ? Math.round(this.v) : '—';
    const u = Math.max(0, Math.min(1, (this.v - 60) / 50));
    attr(this.bar, { width: ((this.w - 28) * u).toFixed(1), fill: pColor(u) });
    const L = this.lines;
    L[0].textContent = P.muffler === false ? 'Sem silencioso' : `Silencioso: abafamento ${Math.round((P.baffle ?? 1) * 100)}%`;
    L[1].textContent = `Tubos: ${fmt(P.pipeLen ?? 1, 2)}× o original`;
    L[2].textContent = E.cyl === 4 ? `Válvula: ${flapOpen(st, P, E) ? 'aberta' : 'fechada'}${P.flap === 'auto' ? ' (automática)' : ''}` : 'Tubos com cruzamento';
    L[3].textContent = (P.pipeLen ?? 1) > 1.05 ? 'Tubos longos: mais força no meio' : (P.pipeLen ?? 1) < 0.95 ? 'Tubos curtos: mais força em cima' : '';
  }
}
