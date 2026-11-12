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
  let db = 60 + 18 * load + 16 * Math.min(1.1, st.rpm / E.limit) + 14 * o + (P.muffler === false ? 5 : 0) + (E.car ? 0 : E.cyl === 2 ? 4 : E.cyl === 1 ? -7 : 0);
  if (E.key === 'i4' && P.muffler !== false && o < 0.3) db -= 4 * (1 - flapOpen(st, P, E));
  if (E.car) db += (E.turbo ? -7 : -3) + 4 * Math.min(1, st.boost || 0);   // escapamento de carro abafa mais
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
    const b = this.g = el('g', { 'data-comp': 'exhaustSys', 'clip-path': 'url(#viewClip)' }, g);
    el('rect', { x, y, width: w, height: 104, rx: 12, fill: '#0d151e', stroke: '#263446' }, b);
    txt(b, x + 14, y + 24, 'Ruído estimado', { 'font-size': 12.5, fill: '#8da0b6' });
    this.db = txt(b, x + 14, y + 66, '—', { 'font-size': 34, 'font-weight': 800, fill: '#fff', 'font-family': 'var(--mono)' });
    txt(b, x + 132, y + 66, 'dB', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end' });
    el('rect', { x: x + 14, y: y + 80, width: 118, height: 8, rx: 4, fill: '#1a2430' }, b);
    this.bar = el('rect', { x: x + 14, y: y + 80, width: 0, height: 8, rx: 4 }, b);
    this.lines = [0, 1, 2, 3].map((k) => txt(b, x + 144, y + 26 + k * 21, '', { 'font-size': 13, fill: '#c2cfdc' }));
    this.v = 0;
  }

  update(st, P, dt) {
    const E = profile(P);
    const d = noiseDb(st, P);
    this.v += (d - this.v) * (1 - Math.exp(-dt / 0.25));
    this.db.textContent = d > 0 ? Math.round(this.v) : '—';
    const u = Math.max(0, Math.min(1, (this.v - 60) / 50));
    attr(this.bar, { width: (118 * u).toFixed(1), fill: pColor(u) });
    const L = this.lines;
    L[0].textContent = P.muffler === false ? 'Sem silencioso' : `Abafamento ${Math.round((P.baffle ?? 1) * 100)}%`;
    L[1].textContent = `Tubos ${fmt(P.pipeLen ?? 1, 2)}×`;
    L[2].textContent = E.exhNote ? E.exhNote : E.cyl === 4 ? `Válvula ${flapOpen(st, P, E) ? 'aberta' : 'fechada'}${P.flap === 'auto' ? ' (auto)' : ''}` : E.cyl === 2 ? 'Tubos com cruzamento' : 'Um tubo só';
    L[3].textContent = (P.pipeLen ?? 1) > 1.05 ? 'Tubo longo: força no meio' : (P.pipeLen ?? 1) < 0.95 ? 'Tubo curto: força em cima' : '';
  }
}

// Gases saindo da ponteira: quantidade, velocidade e comprimento crescem com o giro e a carga.
// Cor: cinza-claro quente (normal), vapor branco (motor frio), cinza-escuro (mistura rica).
// Nos pipocos (corte na desaceleração ou no corte de giro, com escape aberto) aparece uma chama na ponta.
export class ExhaustPlume {
  constructor(g, n = 70) {
    this.g = el('g', { 'pointer-events': 'none' }, g);
    this.tails = [];
    this.n = n;
    this.flames = [];
  }
  setTails(tails) {
    // tails: [{ x, y }] em coordenadas do grupo
    if (this.tails.length !== tails.length) {
      this.g.innerHTML = '';
      this.pool = tails.map(() => Array.from({ length: this.n }, () => ({ e: el('circle', { r: 0 }, this.g), age: 9, life: 1 })));
      this.flames = tails.map(() => el('ellipse', { rx: 0, ry: 0, fill: 'url(#flame)' }, this.g));
      this.acc = tails.map(() => 0);
    }
    this.tails = tails;
  }
  reset() { if (this.pool) for (const ps of this.pool) for (const q of ps) { q.age = 9; q.e.setAttribute('r', 0); } }

  update(st, P, dt) {
    if (!this.pool) return;
    const E = profile(P);
    const run = st.running && !st.broken;
    const rel = Math.min(1.1, Math.max(0, st.rpm) / E.limit);
    const load = Math.max(0, Math.min(1, st.pr)) * (st.comb > 0 ? 1 : 0.35);
    const o = exhaustOpen(P);
    const flow = run ? (0.15 + 0.85 * rel) * (0.35 + 0.65 * load) : st.starter ? 0.08 : 0;
    const rate = flow > 0 ? 8 + 110 * flow : 0;          // partículas por segundo em cada ponteira
    const speed = 40 + 430 * flow * (1 + 0.3 * o);     // px/s
    const cold = st.temp.coolant < 50, rich = st.lambda < 0.84 && run;
    const col = cold ? '#eef3f8' : rich ? '#5d636b' : '#c9d3dd';
    const op = cold ? 0.45 : rich ? 0.5 : 0.3;
    this.tails.forEach((t, ti) => {
      const ps = this.pool[ti];
      this.acc[ti] += rate * dt;
      while (this.acc[ti] >= 1) {
        this.acc[ti] -= 1;
        const q = ps.find((x) => x.age >= x.life);
        if (!q) break;
        q.age = 0; q.life = 0.7 + 0.7 * Math.random();
        q.x = t.x + 2; q.y = t.y + (Math.random() - 0.5) * 6;
        q.vx = speed * (0.75 + 0.5 * Math.random()); q.vy = (Math.random() - 0.5) * 30 - 8;
        q.r0 = 3 + 3 * flow; q.gr = 10 + 34 * flow;
        q.e.setAttribute('fill', col);
      }
      for (const q of ps) {
        if (q.age >= q.life) continue;
        q.age += dt;
        const k = Math.exp(-1.2 * dt);
        q.vx *= k; q.vy = q.vy * k - 14 * dt;   // perde velocidade e sobe um pouco (gás quente)
        q.x += q.vx * dt; q.y += q.vy * dt;
        const u = Math.min(1, q.age / q.life);
        if (u >= 1) { q.e.setAttribute('r', 0); continue; }
        attr(q.e, { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (q.r0 + q.gr * u).toFixed(1), 'fill-opacity': (op * Math.pow(1 - u, 1.5)).toFixed(3) });
      }
      // chama dos pipocos
      const popping = run && (st.cut.decel || st.cut.lim || st.cut.qs > 0) && o > 0.4;
      const fl = popping && Math.random() < 0.25 * o ? 1 : 0;
      attr(this.flames[ti], { cx: t.x + 10, cy: t.y, rx: fl ? 10 + 10 * Math.random() : 0, ry: fl ? 5 + 3 * Math.random() : 0, 'fill-opacity': fl ? 0.9 : 0 });
    });
  }
}
