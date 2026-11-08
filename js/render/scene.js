// Desenho do motor (SVG). Construído uma vez; a cada quadro só mudam atributos.
// Regiões da cena (1400 × 784):
//   esquerda  – vista frontal em corte dos 4 cilindros (virabrequim no plano da tela)
//   direita   – corte transversal de um cilindro (clique num cilindro para escolher)
//   embaixo   – roda do ciclo (720°) e escape 4-2-1
// Tudo usa o ângulo visual (st.vis.theta), que gira em câmera lenta.
import { el, txt, attr, gasColor, tempColor, pColor, fmt, fmtInt } from './svg.js';
import { ENGINES, profile } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, strokeOf } from '../sim/engine.js';
import { V2View } from './scene-v2.js';
import { drawMuffler, mufKey, ExhaustInfo, flapOpen } from './exhaust-common.js';

const ENG = ENGINES.i4, VALVES = ENG.valve;

const D2R = Math.PI / 180;
const STROKES = ['Admissão', 'Compressão', 'Explosão', 'Escape'];
const STROKE_COL = ['#3d7fe0', '#2bb39a', '#f08a2c', '#8b7d70'];

// ---------- geometria da vista frontal ----------
const F = { s: 1.25, x: [205, 325, 445, 565], yc: 548 };
F.R = (ENG.stroke / 2) * F.s; F.L = ENG.rod * F.s; F.ch = 28 * F.s; F.bh = 40 * F.s;
F.crownTdc = F.yc - F.R - F.L - F.ch;
F.deck = F.crownTdc - 2;
F.roof = F.deck - 15;
F.camEx = F.deck - 118; F.camIn = F.deck - 130;
F.top = F.deck - 165;

// ---------- geometria do corte transversal ----------
const T = { s: 1.35, x0: 1060, yc: 452 };
T.R = (ENG.stroke / 2) * T.s; T.L = ENG.rod * T.s; T.ch = 28 * T.s; T.bh = 40 * T.s;
T.crownTdc = T.yc - T.R - T.L - T.ch;
T.deck = T.crownTdc - 2;
T.apex = T.deck - 21;
const vax = (tilt, side) => ({ x: side * Math.sin(tilt * D2R), y: -Math.cos(tilt * D2R) });
T.uIn = vax(14, -1); T.uEx = vax(12, 1);
T.seatIn = { x: T.x0 - 27, y: T.deck - 10.5 };
T.seatEx = { x: T.x0 + 27, y: T.deck - 10.5 };
T.stem = 118;
T.camInC = { x: T.seatIn.x + T.uIn.x * (T.stem + 20), y: T.seatIn.y + T.uIn.y * (T.stem + 20) };
T.camExC = { x: T.seatEx.x + T.uEx.x * (T.stem + 20), y: T.seatEx.y + T.uEx.y * (T.stem + 20) };

function slider(theta, R, L) {
  const a = theta * D2R, sx = R * Math.sin(a);
  return { px: sx, py: -R * Math.cos(a), pin: -(R * Math.cos(a) + Math.sqrt(L * L - sx * sx)) };
}

export class Scene {
  constructor(svg, overlay) {
    this.svg = svg;
    this.ov = overlay;
    this.layers = { labels: true, values: true, gas: true, flow: true };
    this.sel = null;
    this.cyl = 0;          // cilindro mostrado no corte
    this.onPick = null;
    this.onCyl = null;
    attr(svg, { viewBox: '0 0 1400 784' });
    attr(overlay, { viewBox: '0 0 1400 784' });
    this.build();
    svg.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cyl]');
      if (c) { this.setCyl(+c.dataset.cyl); }
      const t = e.target.closest('[data-comp]');
      if (t && this.onPick) this.onPick(t.dataset.comp);
    });
    this.resetFx();
  }

  setCyl(i) { this.cyl = i; if (this.onCyl) this.onCyl(i); }

  // formato da tela e aba (9:16): cada aba mostra uma região da cena, com os textos ampliados
  setFormat(fmt) {
    this.fmt = fmt;
    this.setTextScale(fmt === 'f916' ? 1.45 : 1);
    this.applyView();
  }
  setTab(tab) { this.tab = tab; this.applyView(); }
  applyView() {
    const v2 = this.engine === 'v2';
    const VIEWS = {
      motor: v2 ? '0 0 702 784' : '0 10 702 700',
      dentro: '702 0 698 534',
      escape: '716 540 684 244',
    };
    const vb = this.fmt === 'f916' ? VIEWS[this.tab || 'motor'] : '0 0 1400 784';
    this.svg.setAttribute('viewBox', vb);
    // recorta só a região da aba (no 9:16 a tela é mais larga que a vista)
    const [x, y, w, h] = vb.split(' ').map(Number);
    attr(this.clipR, { x, y, width: w, height: h });
  }
  setTextScale(k) {
    this.svg.querySelectorAll('text').forEach((t) => {
      if (!t.dataset.fs) t.dataset.fs = t.getAttribute('font-size') || 12;
      t.setAttribute('font-size', (+t.dataset.fs * k).toFixed(1));
    });
  }

  resetFx() {
    this.flowIn = 0; this.flowEx = 0; this.chain = 0; this.oilPh = 0; this.waves = []; this.waveT = 0; this.lastTheta = null;
  }

  setLayers(o) {
    Object.assign(this.layers, o);
    for (const k of ['labels', 'values', 'gas', 'flow']) this.svg.classList.toggle('hide-' + k, !this.layers[k]);
  }

  setSel(id) {
    this.sel = id;
    this.svg.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
    if (id) this.svg.querySelectorAll(`[data-comp="${id}"]`).forEach((e) => e.classList.add('sel'));
  }

  focus(ids) {
    this.svg.classList.toggle('dim', !!(ids && ids.length));
    this.svg.querySelectorAll('.focus').forEach((e) => e.classList.remove('focus'));
    if (ids) for (const id of ids) this.svg.querySelectorAll(`[data-comp="${id}"]`).forEach((e) => e.classList.add('focus'));
  }

  // ======================================================================
  build() {
    const svg = this.svg;
    const defs = el('defs', {}, svg);
    // grade de fundo
    const pat = el('pattern', { id: 'grid', width: 28, height: 28, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M28 0H0V28', fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.035 }, pat);
    const fl = el('radialGradient', { id: 'flame' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff6c0', 'stop-opacity': 1 }, fl);
    el('stop', { offset: '0.35', 'stop-color': '#ffb12e', 'stop-opacity': 0.9 }, fl);
    el('stop', { offset: '1', 'stop-color': '#ff5a1f', 'stop-opacity': 0 }, fl);
    const glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3 }, glow);
    const mist = el('linearGradient', { id: 'mist', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': '#dff3ff', 'stop-opacity': 0.9 }, mist);
    el('stop', { offset: '1', 'stop-color': '#dff3ff', 'stop-opacity': 0 }, mist);
    const cp = el('clipPath', { id: 'viewClip' }, defs);
    this.clipR = el('rect', { x: 0, y: 0, width: 1400, height: 784 }, cp);
    el('rect', { x: 0, y: 0, width: 1400, height: 784, fill: 'url(#grid)', class: 'bgx' }, svg);

    // divisórias discretas entre as regiões
    el('line', { x1: 702, y1: 18, x2: 702, y2: 766, stroke: '#ffffff', 'stroke-opacity': 0.06 }, svg);
    el('line', { x1: 716, y1: 534, x2: 1390, y2: 534, stroke: '#ffffff', 'stroke-opacity': 0.06 }, svg);

    this.gI4 = el('g', {}, svg);
    this.buildFront(el('g', {}, this.gI4));
    this.buildSection(el('g', {}, this.gI4));
    this.buildExhaust(el('g', { transform: 'translate(-240 0)' }, this.gI4));
    this.exInfo = new ExhaustInfo(svg, 1176, 552, 212);
    this.gV2 = el('g', {}, svg);
    this.v2 = new V2View(this, this.gV2);
    for (const c of svg.children) if (c.tagName !== 'defs') c.setAttribute('clip-path', 'url(#viewClip)');
    this.engine = null;
  }

  // ---------------------------------------------------------------- frontal
  buildFront(g) {
    const f = this.f = { cyl: [] };
    const X0 = F.x[0] - 78, X1 = F.x[3] + 78;
    txt(g, 24, 40, 'Os 4 cilindros', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    f.order = txt(g, 24, 64, '', { 'font-size': 14, fill: '#8da0b6' });
    f.slow = txt(g, 680, 40, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    // cabeçote, bloco e cárter
    const head = el('g', { 'data-comp': 'head' }, g);
    el('path', { d: `M${X0} ${F.deck} V${F.top + 18} q0 -18 18 -18 H${X1 - 18} q18 0 18 18 V${F.deck} Z`, fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2 }, head);
    el('rect', { x: X0 + 6, y: F.top - 10, width: X1 - X0 - 12, height: 14, rx: 6, fill: '#323f4f', stroke: '#5b6d82', 'stroke-width': 1 }, head);
    const block = el('g', { 'data-comp': 'block' }, g);
    el('path', { d: `M${X0} ${F.deck} H${X1} V${F.yc - 40} H${X0} Z`, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2 }, block);
    // camisa d'água (cor = temperatura da água)
    f.water = [];
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? X0 + 5 : i === 4 ? X1 - 13 : (F.x[i - 1] + F.x[i]) / 2 - 4;
      f.water.push(el('rect', { x, y: F.deck + 6, width: 8, height: 92, rx: 3, 'data-comp': 'coolant', class: 'L-gas' }, block));
    }
    const crankcase = el('g', { 'data-comp': 'crankcase' }, g);
    el('path', { d: `M${X0} ${F.yc - 40} H${X1} V${F.yc + 52} Q${X1} ${F.yc + 74} ${X1 - 30} ${F.yc + 78} H${X0 + 30} Q${X0} ${F.yc + 74} ${X0} ${F.yc + 52} Z`, fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, crankcase);
    const sump = el('g', { 'data-comp': 'oil' }, g);
    el('path', { d: `M${X0 + 40} ${F.yc + 78} H${X1 - 40} V${F.yc + 104} q0 10 -10 10 H${X0 + 50} q-10 0 -10 -10 Z`, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, sump);
    f.oil = el('path', { fill: '#b5832a', 'fill-opacity': 0.75 }, sump);

    // corrente de comando (lado direito)
    const ch = el('g', { 'data-comp': 'chain' }, g);
    const cx = X1 + 26;
    el('rect', { x: X1, y: F.camIn - 26, width: 52, height: F.yc - F.camIn + 56, rx: 16, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1 }, ch);
    f.chainPath = `M${cx - 12} ${F.camIn} V${F.yc} A12 12 0 0 0 ${cx + 12} ${F.yc} V${F.camEx} A12 12 0 0 0 ${cx - 12} ${F.camIn}`;
    f.chain = el('path', { d: `M${cx - 13} ${F.camIn - 2} L${cx - 9} ${F.yc} A10 10 0 0 0 ${cx + 9} ${F.yc} L${cx + 13} ${F.camIn - 2} A13 13 0 0 0 ${cx - 13} ${F.camIn - 2}`, fill: 'none', stroke: '#9aa7b6', 'stroke-width': 3, 'stroke-dasharray': '3 3' }, ch);
    f.spr = [F.camIn, F.camEx, F.yc].map((y, k) => el('circle', { cx, cy: k === 2 ? y : y - (k === 0 ? 0 : 0), r: k === 2 ? 10 : 13, fill: '#3a4859', stroke: '#8a98a8', 'stroke-width': 1.2 }, ch));

    // eixos de comando (atrás = admissão, mais claro)
    const camIn = el('g', { 'data-comp': 'camIn' }, g);
    el('rect', { x: X0 + 10, y: F.camIn - 5, width: X1 - X0 + 2, height: 10, rx: 5, fill: '#5b7aa6', 'fill-opacity': 0.55 }, camIn);
    const camEx = el('g', { 'data-comp': 'camEx' }, g);
    el('rect', { x: X0 + 10, y: F.camEx - 5, width: X1 - X0 + 2, height: 10, rx: 5, fill: '#a6795b', 'fill-opacity': 0.8 }, camEx);

    // virabrequim: eixo principal
    const crank = el('g', { 'data-comp': 'crank' }, g);
    el('rect', { x: X0 + 6, y: F.yc - 9, width: X1 - X0 + 30, height: 18, rx: 6, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, crank);
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? F.x[0] - 60 : i === 4 ? F.x[3] + 60 : (F.x[i - 1] + F.x[i]) / 2;
      el('rect', { x: x - 9, y: F.yc - 15, width: 18, height: 30, rx: 3, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'bearing' }, g);
    }

    for (let i = 0; i < 4; i++) f.cyl.push(this.buildFrontCyl(g, i));

    // nomes (prateleira à esquerda, linhas para o cilindro 1)
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const x1 = F.x[0] - 50;
    const lab = (y, s, tx, ty) => {
      txt(L, 24, y + 4, s, { 'font-size': 12.5, fill: '#aebdcc' });
      el('path', { d: `M${100} ${y} H${tx}${ty !== undefined ? ` V${ty}` : ''}`, fill: 'none', stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6 }, L);
      el('circle', { cx: tx, cy: ty ?? y, r: 2, fill: '#8da0b6' }, L);
    };
    lab(F.camIn, 'Comando adm.', x1);
    lab(F.camEx + 12, 'Comando esc.', x1 + 14, F.camEx + 3);
    lab(F.deck - 60, 'Válvulas', F.x[0] - 20);
    lab(F.roof + 6, 'Câmara', F.x[0] - 44);
    lab(F.crownTdc + 34, 'Pistão', F.x[0] - 40);
    lab(F.yc - 70, 'Biela', F.x[0] - 6);
    lab(F.yc + 10, 'Virabrequim', F.x[0] - 34, F.yc + 10);
    lab(F.yc + 95, 'Óleo', X0 + 60);
    f.waterLbl = null;
  }

  buildFrontCyl(g, i) {
    const x = F.x[i], o = {};
    const cg = el('g', { 'data-cyl': i, class: 'cylg' }, g);
    // camisa (parede) e gás
    el('rect', { x: x - 54, y: F.roof, width: 108, height: F.yc - 40 - F.roof, fill: '#151d27', 'data-comp': 'cylinder' }, cg);
    o.gas = el('rect', { x: x - 50, y: F.roof, width: 100, height: 20, 'data-comp': 'chamber', class: 'L-gas' }, cg);
    o.flame = el('ellipse', { cx: x, cy: F.roof + 6, rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, cg);
    el('line', { x1: x - 50, y1: F.roof, x2: x - 50, y2: F.yc - 40, stroke: '#7e8ea0', 'stroke-width': 1.2 }, cg);
    el('line', { x1: x + 50, y1: F.roof, x2: x + 50, y2: F.yc - 40, stroke: '#7e8ea0', 'stroke-width': 1.2 }, cg);

    // válvulas (admissão atrás, mais clara; escape na frente)
    o.vIn = [-1, 1].map((sd) => {
      const v = el('g', { 'data-comp': 'valveIn' }, cg);
      el('path', { d: `M${x + sd * 21 - 15} ${F.roof + 1} L${x + sd * 21 + 15} ${F.roof + 1} L${x + sd * 21 + 3} ${F.roof - 6} V${F.deck - 100} H${x + sd * 21 - 3} V${F.roof - 6} Z`, fill: '#7f9cc6', 'fill-opacity': 0.5, stroke: '#a8c3ea', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }, v);
      return v;
    });
    o.vEx = [-1, 1].map((sd) => {
      const v = el('g', { 'data-comp': 'valveEx' }, cg);
      el('path', { d: `M${x + sd * 21 - 14} ${F.roof} L${x + sd * 21 + 14} ${F.roof} L${x + sd * 21 + 3} ${F.roof - 7} V${F.deck - 96} H${x + sd * 21 - 3} V${F.roof - 7} Z`, fill: '#c9b2a0', stroke: '#2b3542', 'stroke-width': 0.8 }, v);
      // mola e tucho
      el('path', { d: Array.from({ length: 7 }, (_, k) => `M${x + sd * 21 - 8} ${F.deck - 96 + k * 4.2} l16 2.1`).join(' '), stroke: '#8fa0b2', 'stroke-width': 1.2, fill: 'none' }, v);
      el('rect', { x: x + sd * 21 - 9, y: F.deck - 108, width: 18, height: 11, rx: 2, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 0.8 }, v);
      return v;
    });
    // ressaltos dos comandos (projeção de lado)
    o.lobeIn = [-1, 1].map((sd) => el('rect', { x: x + sd * 21 - 7, width: 14, rx: 6, fill: '#7f9cc6', 'fill-opacity': 0.75, 'data-comp': 'camIn' }, cg));
    o.lobeEx = [-1, 1].map((sd) => el('rect', { x: x + sd * 21 - 7, width: 14, rx: 6, fill: '#c08a62', 'data-comp': 'camEx' }, cg));

    // vela e bobina
    const sp = el('g', { 'data-comp': 'spark' }, cg);
    el('rect', { x: x - 3.5, y: F.top + 4, width: 7, height: F.roof - F.top - 6, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8 }, sp);
    el('rect', { x: x - 11, y: F.top - 14, width: 22, height: 22, rx: 4, fill: '#20262e', stroke: '#5b6d82', 'stroke-width': 1 }, sp);
    o.spark = el('circle', { cx: x, cy: F.roof + 2, r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, cg);

    // pistão, biela, manivela (virabrequim visto de lado: o moente sobe e desce)
    o.cw = el('rect', { x: x - 36, width: 72, rx: 10, fill: '#4a5768', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'crank' }, cg);
    o.webs = [-1, 1].map((sd) => el('rect', { x: x + sd * 25 - 7, width: 14, rx: 6, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'crank' }, cg));
    o.rod = el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.bigEnd = el('rect', { x: x - 17, width: 34, height: 26, rx: 8, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.piston = el('g', { 'data-comp': 'piston' }, cg);
    el('rect', { x: x - 49, y: 0, width: 98, height: F.bh, rx: 3, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    for (const yy of [5, 9, 13]) el('line', { x1: x - 49, y1: yy, x2: x + 49, y2: yy, stroke: '#4f5b69', 'stroke-width': 1 }, o.piston);
    el('circle', { cx: x, cy: F.ch, r: 7, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);

    // número e tempo
    o.num = txt(g, x, F.top - 52, `${i + 1}`, { 'font-size': 26, 'font-weight': 800, fill: '#e6edf3', 'text-anchor': 'middle', 'data-cyl': i, style: 'cursor:pointer' });
    o.chipR = el('rect', { x: x - 57, y: F.top - 43, width: 114, height: 24, rx: 12, 'data-cyl': i, style: 'cursor:pointer' }, g);
    o.chip = txt(g, x, F.top - 26.5, '', { 'font-size': 12.5, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' });
    o.selR = el('rect', { x: x - 58, y: F.top - 78, width: 116, height: F.yc + 120 - F.top + 78, rx: 12, fill: 'none', stroke: '#4fa3ff', 'stroke-width': 1.5, 'stroke-dasharray': '5 5', 'pointer-events': 'none' }, g);
    o.pv = txt(g, x, F.deck + 60, '', { 'font-size': 12, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'var(--mono)', class: 'L-values', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    return o;
  }

  // ---------------------------------------------------------------- corte transversal
  buildSection(g) {
    const s = this.s = {};
    const { x0, yc, deck, apex } = T;
    s.title = txt(g, 724, 40, '', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    s.sub = txt(g, 724, 64, 'Corte transversal', { 'font-size': 14, fill: '#8da0b6' });
    txt(g, 724, 82, 'admissão ← · → escape', { 'font-size': 13, fill: '#6f8297' });
    s.strokeR = el('rect', { x: 1220, y: 22, width: 166, height: 34, rx: 17 }, g);
    s.strokeT = txt(g, 1303, 45, '', { 'font-size': 17, 'font-weight': 800, fill: '#0b1118', 'text-anchor': 'middle' });

    // cabeçote
    const head = el('g', { 'data-comp': 'head' }, g);
    const hx0 = x0 - 112, hx1 = x0 + 112, hy0 = T.camInC.y - 34;
    el('path', { d: `M${x0 - 54} ${deck} L${x0 - 70} ${deck} L${x0 - 70} ${deck - 18} L${x0 - 100} ${deck - 55} L${hx0} ${hy0 + 20} Q${hx0} ${hy0} ${hx0 + 20} ${hy0} H${hx1 - 20} Q${hx1} ${hy0} ${hx1} ${hy0 + 20} L${x0 + 100} ${deck - 55} L${x0 + 70} ${deck - 18} L${x0 + 70} ${deck} L${x0 + 54} ${deck} L${x0} ${apex} Z`, fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2 }, head);
    el('rect', { x: hx0 + 4, y: hy0 - 12, width: hx1 - hx0 - 8, height: 14, rx: 7, fill: '#323f4f', stroke: '#5b6d82', 'stroke-width': 1 }, head);

    // caixa de ar e duto de admissão (atrás do cabeçote)
    const air = el('g', { 'data-comp': 'airbox' }, g);
    el('rect', { x: 722, y: 112, width: 70, height: 120, rx: 14, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, air);
    el('path', { d: 'M736 132 h42 M736 146 h42 M736 160 h42 M736 174 h42 M736 188 h42 M736 202 h42', stroke: '#3b4a5c', 'stroke-width': 1 }, air);
    s.filter = el('rect', { x: 730, y: 124, width: 54, height: 96, rx: 6, fill: 'none', stroke: '#c9b26a', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'data-comp': 'filter' }, air);
    s.inPath = `M${792} 172 L${880} 172 C${930} 172 ${960} 168 ${985} ${deck - 70} C${1005} ${deck - 40} ${T.seatIn.x - 8} ${deck - 30} ${T.seatIn.x} ${T.seatIn.y - 4}`;
    el('path', { d: s.inPath, fill: 'none', stroke: '#5b6d82', 'stroke-width': 40, 'stroke-linecap': 'round' }, g);
    s.inGas = el('path', { d: s.inPath, fill: 'none', 'stroke-width': 34, 'stroke-linecap': 'round', 'data-comp': 'intake', class: 'L-gas' }, g);
    s.inFlow = el('path', { d: s.inPath, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g);

    // corpo de borboleta
    const tb = el('g', { 'data-comp': 'throttle' }, g);
    el('rect', { x: 832, y: 146, width: 46, height: 52, rx: 4, fill: 'none', stroke: '#9aa7b6', 'stroke-width': 1.5 }, tb);
    s.butterfly = el('line', { x1: 855, y1: 152, x2: 855, y2: 192, stroke: '#e6edf3', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, tb);
    el('circle', { cx: 855, cy: 172, r: 3, fill: '#e6edf3' }, tb);

    // escape: porta e coletor
    s.exPath = `M${T.seatEx.x} ${T.seatEx.y - 4} C${T.seatEx.x + 20} ${deck - 34} ${x0 + 88} ${deck - 44} ${x0 + 128} ${deck - 30} C${x0 + 190} ${deck - 10} ${x0 + 215} ${deck + 40} ${x0 + 222} ${deck + 120} L${x0 + 228} 524`;
    el('path', { d: s.exPath, fill: 'none', stroke: '#5b6d82', 'stroke-width': 38, 'stroke-linecap': 'butt' }, g);
    s.exGas = el('path', { d: s.exPath, fill: 'none', 'stroke-width': 32, 'data-comp': 'header', class: 'L-gas' }, g);
    s.exFlow = el('path', { d: s.exPath, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g);

    // cilindro e bloco
    const blk = el('g', { 'data-comp': 'block' }, g);
    el('path', { d: `M${x0 - 72} ${deck} H${x0 - 54} V${deck + 112} H${x0 - 72} Z M${x0 + 54} ${deck} H${x0 + 72} V${deck + 112} H${x0 + 54} Z`, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2 }, blk);
    s.water = [el('rect', { x: x0 - 68, y: deck + 8, width: 9, height: 78, rx: 3, 'data-comp': 'coolant', class: 'L-gas' }, blk),
      el('rect', { x: x0 + 59, y: deck + 8, width: 9, height: 78, rx: 3, 'data-comp': 'coolant', class: 'L-gas' }, blk)];
    const cc = el('g', { 'data-comp': 'crankcase' }, g);
    el('path', { d: `M${x0 - 72} ${deck + 112} L${x0 - 104} ${yc - 20} V${yc + 34} Q${x0 - 104} ${yc + 62} ${x0 - 76} ${yc + 62} H${x0 + 76} Q${x0 + 104} ${yc + 62} ${x0 + 104} ${yc + 34} V${yc - 20} L${x0 + 72} ${deck + 112} Z`, fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, cc);
    s.oil = el('path', { fill: '#b5832a', 'fill-opacity': 0.7, 'data-comp': 'oil' }, g);

    // gás no cilindro
    s.gas = el('path', { 'data-comp': 'chamber', class: 'L-gas' }, g);
    s.flame = el('circle', { cx: x0, cy: apex + 6, r: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, g);

    // bico injetor
    const inj = el('g', { 'data-comp': 'injector' }, g);
    const ij = { x: 958, y: deck - 96 };
    el('path', { d: `M${ij.x - 8} ${ij.y - 26} h16 v20 l-4 10 h-8 l-4 -10 z`, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1 }, inj);
    s.spray = el('path', { d: `M${ij.x} ${ij.y + 4} L${T.seatIn.x - 2} ${T.seatIn.y - 22} L${T.seatIn.x - 26} ${T.seatIn.y - 8} Z`, fill: 'url(#mist)', 'fill-opacity': 0, 'pointer-events': 'none' }, g);

    // válvulas, molas, tuchos, comandos
    const valve = (seat, u, comp, col) => {
      const v = el('g', { 'data-comp': comp }, g);
      const n = { x: -u.y, y: u.x };
      const hw = 19, top = { x: seat.x + u.x * T.stem, y: seat.y + u.y * T.stem };
      const p = (a, b) => `${(seat.x + u.x * a + n.x * b).toFixed(1)} ${(seat.y + u.y * a + n.y * b).toFixed(1)}`;
      el('path', { d: `M${p(0, -hw)} L${p(0, hw)} L${p(6, 3)} L${p(T.stem, 3)} L${p(T.stem, -3)} L${p(6, -3)} Z`, fill: col, stroke: '#2b3542', 'stroke-width': 0.9 }, v);
      el('path', { d: Array.from({ length: 8 }, (_, k) => `M${p(T.stem - 44 + k * 4.5, -10)} L${p(T.stem - 42 + k * 4.5, 10)}`).join(' '), stroke: '#8fa0b2', 'stroke-width': 1.3, fill: 'none' }, v);
      el('path', { d: `M${p(T.stem - 6, -11)} L${p(T.stem - 6, 11)} L${p(T.stem + 6, 11)} L${p(T.stem + 6, -11)} Z`, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 0.9 }, v);
      void top;
      return v;
    };
    s.vIn = valve(T.seatIn, T.uIn, 'valveIn', '#9db6d8');
    s.vEx = valve(T.seatEx, T.uEx, 'valveEx', '#c9b2a0');
    // guias de válvula (fixas)
    const lobe = (c, comp, col) => {
      const gg = el('g', { 'data-comp': comp }, g);
      const rb = 15, pts = [];
      for (let a = 0; a < 360; a += 6) {
        const d = ((a + 180) % 360) - 180;
        const nose = Math.abs(d) < 70 ? Math.cos(d / 70 * Math.PI / 2) ** 2 : 0;
        const r = rb + 15 * nose;
        pts.push(`${(r * Math.cos(a * D2R)).toFixed(1)},${(r * Math.sin(a * D2R)).toFixed(1)}`);
      }
      const rot = el('g', {}, gg);
      el('polygon', { points: pts.join(' '), fill: col, stroke: '#2b3542', 'stroke-width': 1 }, rot);
      el('circle', { r: 5, fill: '#2b3542' }, rot);
      el('circle', { cx: c.x, cy: c.y, r: 24, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.06 }, gg);
      return { g: gg, rot, c };
    };
    s.camIn = lobe(T.camInC, 'camIn', '#7f9cc6');
    s.camEx = lobe(T.camExC, 'camEx', '#c08a62');
    s.camMode = txt(g, 724, 300, '', { 'font-size': 12.5, fill: '#9db6d8', 'text-anchor': 'start', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });

    // vela
    const sp = el('g', { 'data-comp': 'spark' }, g);
    el('rect', { x: x0 - 3.5, y: T.camInC.y - 40, width: 7, height: apex - T.camInC.y + 38, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8 }, sp);
    el('rect', { x: x0 - 9, y: T.camInC.y - 62, width: 18, height: 24, rx: 4, fill: '#20262e', stroke: '#5b6d82', 'stroke-width': 1 }, sp);
    s.spark = el('circle', { cx: x0, cy: apex + 3, r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, g);

    // virabrequim, biela, pistão
    s.crank = el('g', { 'data-comp': 'crank' }, g);
    el('path', { d: 'M-34 12 A44 44 0 0 0 34 12 L18 -6 A20 20 0 0 1 -18 -6 Z', fill: '#4a5768', stroke: '#2b3542', 'stroke-width': 1 }, s.crank);
    el('path', { d: `M-17 0 L-12 ${-T.R} A12 12 0 0 1 12 ${-T.R} L17 0 A17 17 0 0 1 -17 0`, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, s.crank);
    el('circle', { r: 14, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, s.crank);
    s.rod = el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, g);
    s.pinC = el('circle', { r: 11, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, g);
    s.piston = el('g', { 'data-comp': 'piston' }, g);
    el('path', { d: `M${x0 - 52} 2 Q${x0} -6 ${x0 + 52} 2 V${T.bh} H${x0 - 52} Z`, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, s.piston);
    for (const yy of [7, 12, 17]) el('line', { x1: x0 - 52, y1: yy, x2: x0 + 52, y2: yy, stroke: '#4f5b69', 'stroke-width': 1 }, s.piston);
    el('circle', { cx: x0, cy: T.ch, r: 8, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, s.piston);

    // nomes
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, t, anchor = 'start', lx, ly) => {
      if (lx !== undefined) el('path', { d: `M${lx} ${ly} L${x + (anchor === 'end' ? 4 : -4)} ${y - 4}`, stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6, fill: 'none' }, L);
      txt(L, x, y, t, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': anchor, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    };
    lab(724, 252, 'Caixa de ar');
    lab(855, 220, 'Borboleta', 'middle');
    lab(942, 136, 'Bico injetor', 'end');
    lab(T.camInC.x - 34, T.camInC.y + 2, 'Comando de adm.', 'end');
    lab(T.camExC.x + 34, T.camExC.y + 4, 'Comando de esc.', 'start');
    lab(x0 + 16, T.camInC.y - 46, 'Vela', 'start');
    lab(975, deck + 22, 'Válvula de adm.', 'end', T.seatIn.x - 14, T.seatIn.y - 12);
    lab(x0 + 130, deck - 64, 'Válvula de esc.', 'start', T.seatEx.x + 18, T.seatEx.y - 40);
    lab(x0 + 238, deck + 150, 'Coletor', 'start');
    lab(x0 - 120, deck + 70, 'Pistão', 'end', x0 - 56, deck + 40);
    lab(x0 - 120, yc - 66, 'Biela', 'end', x0 - 16, yc - 70);
    lab(x0 - 120, yc + 16, 'Virabrequim', 'end', x0 - 60, yc + 10);
    s.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    const vt = (x, y, a = 'start') => txt(s.vals, x, y, '', { 'font-size': 12.5, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    s.vP = vt(x0, deck + 40, 'middle');
    s.vMap = vt(812, 148, 'middle');
    s.vEgt = vt(x0 + 240, deck + 100);
    s.vTps = vt(855, 236, 'middle');
  }

  // ---------------------------------------------------------------- roda do ciclo
  // ---------------------------------------------------------------- escape 4-2-1
  buildExhaust(g) {
    const e = this.e = { pulses: [] };
    const gg = el('g', { 'data-comp': 'exhaustSys' }, g);
    txt(gg, 990, 558, 'Escape 4-2-1', { 'font-size': 15, 'font-weight': 700, fill: '#e6edf3' });
    e.mufName = txt(gg, 990, 576, '', { 'font-size': 12, fill: '#8da0b6' });
    const yTop = 604, xs = [1010, 1048, 1086, 1124];
    // cada cilindro: primário → secundário (pares 1+4 e 2+3) → coletor → silencioso
    const pairX = [1030, 1104];
    const pairOf = [0, 1, 1, 0];
    const mx = 1067, my = 700;
    e.paths = xs.map((x, i) => {
      const px = pairX[pairOf[i]];
      return `M${x} ${yTop} C${x} ${yTop + 34} ${px} ${yTop + 30} ${px} ${yTop + 58} C${px} ${yTop + 78} ${mx} ${my - 30} ${mx} ${my} C${mx} ${my + 30} ${mx + 40} ${my + 42} ${mx + 90} ${my + 42} H${1250}`;
    });
    e.pipes = e.paths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 13, 'stroke-linecap': 'round', stroke: '#5b6d82' }, gg));
    e.core = e.paths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'L-gas' }, gg));
    e.meas = e.paths.map((d) => el('path', { d, fill: 'none', stroke: 'none' }, gg));
    xs.forEach((x, i) => txt(gg, x, yTop - 8, `${i + 1}`, { 'font-size': 12, 'font-weight': 700, fill: '#aebdcc', 'text-anchor': 'middle' }));
    e.muf = el('g', { 'data-comp': 'muffler' }, gg);
    e.waves = el('g', { 'pointer-events': 'none' }, gg);
    e.pulseG = el('g', { 'pointer-events': 'none' }, gg);
    for (let i = 0; i < 4; i++) e.pulses.push(el('circle', { r: 0, fill: '#fff2c4', filter: 'url(#glow)' }, e.pulseG));
    e.kind = null;
  }

  // ======================================================================
  update(st, P, dt) {
    const E = profile(P);
    if (this.engine !== P.engine) {
      this.engine = P.engine;
      this.gI4.style.display = P.engine === 'i4' ? '' : 'none';
      this.gV2.style.display = P.engine === 'v2' ? '' : 'none';
      if (this.cyl >= E.cyl) this.cyl = 0;
      this.lastTheta = null;
      this.applyView();
    }
    this.exInfo.update(st, P, dt);
    if (P.engine === 'v2') { this.v2.update(st, P, dt); return; }

    const theta = st.vis.theta;
    const off = E.firing[P.crank];
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const pOpt = { pr: st.pr, adv: st.adv, cr: P.cr, lambda: st.lambda, E };
    const local = off.map((o) => ((theta - o) % 720 + 720) % 720);
    const vr = st.vis.rpm;
    const dTheta = this.lastTheta == null ? 0 : ((theta - this.lastTheta) % 720 + 720) % 720;
    this.lastTheta = theta;

    // ---------- frontal ----------
    const f = this.f;
    f.order.textContent = `Ordem de ignição ${E.order[P.crank]} · virabrequim ${P.crank === 'cross' ? 'crossplane (90°)' : 'plano (180°)'}`;
    const ratio = vr > 1 ? st.rpm / vr : 1;
    f.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `animação em câmera lenta · 1:${Math.round(ratio)}`;
    const wc = tempColor(st.temp.coolant, 20, 125);
    f.water.forEach((w) => w.setAttribute('fill', wc));
    this.oilPh += dt * (1 + st.rpm / 2000);
    const oy = F.yc + 96, X0 = F.x[0] - 78 + 40, X1 = F.x[3] + 78 - 40;
    let od = `M${X0} ${oy}`;
    for (let x = X0; x <= X1; x += 12) od += ` L${x} ${oy + Math.sin(x * 0.08 + this.oilPh * 3) * (1 + st.rpm / 6000)}`;
    f.oil.setAttribute('d', `${od} V${F.yc + 114} H${X0} Z`);
    this.chain = (this.chain + dTheta * 0.15) % 6;
    f.chain.setAttribute('stroke-dashoffset', -this.chain);

    for (let i = 0; i < 4; i++) {
      const o = f.cyl[i], th = local[i];
      const crankDeg = th % 360;
      const k = slider(crankDeg, F.R, F.L);
      const x = F.x[i];
      const pinY = F.yc + k.py, ppY = F.yc + k.pin;
      const crown = ppY - F.ch;
      o.piston.setAttribute('transform', `translate(0 ${crown.toFixed(1)})`);
      const cwY = F.yc - k.py * 1.2;
      const y0 = Math.min(pinY, cwY), y1 = Math.max(pinY, cwY);
      attr(o.cw, { y: (F.yc - (Math.abs(k.py) * 0.4 + 10) * Math.sign(-k.py || 1) - 10).toFixed(1), height: 20 });
      attr(o.cw, { y: (Math.min(F.yc, cwY) - 12).toFixed(1), height: (Math.abs(cwY - F.yc) + 24).toFixed(1) });
      o.webs.forEach((w) => attr(w, { y: (y0 - 8).toFixed(1), height: (y1 - y0 + 16).toFixed(1) }));
      attr(o.bigEnd, { y: (pinY - 13).toFixed(1) });
      o.rod.setAttribute('d', `M${x - 7} ${ppY} L${x + 7} ${ppY} L${x + 11} ${pinY} L${x - 11} ${pinY} Z`);
      const cmb = combOn && (i + 1) !== P.failSpark ? 1 : 0;
      const p = cylPressure(th, { ...pOpt, comb: cmb });
      attr(o.gas, { y: F.roof, height: Math.max(1, crown - F.roof + 3).toFixed(1), fill: gasColor(p) });
      o.pv.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
      o.pv.setAttribute('y', Math.min(crown + 30, F.yc - 50).toFixed(0));
      o.pv.setAttribute('y', (F.roof + 34).toFixed(0));
      // válvulas
      const li = intakeLift(th, st.cam, E) * 11.2 * F.s, le = exhaustLift(th, E) * VALVES.exh.lift * F.s;
      o.vIn.forEach((v) => v.setAttribute('transform', `translate(0 ${li.toFixed(1)})`));
      o.vEx.forEach((v) => v.setAttribute('transform', `translate(0 ${le.toFixed(1)})`));
      o.lobeIn.forEach((l) => attr(l, { y: (F.camIn - 8).toFixed(1), height: (16 + li).toFixed(1) }));
      o.lobeEx.forEach((l) => attr(l, { y: (F.camEx - 8).toFixed(1), height: (16 + le).toFixed(1) }));
      // vela e chama
      const sparkA = 360 - st.adv;
      const ds = th - sparkA;
      const sparkOn = running && (i + 1) !== P.failSpark && !st.cut.any && ds >= 0 && ds < 14;
      o.spark.setAttribute('r', sparkOn ? 7 : 0);
      const xb = cmb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
      const fa = cmb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
      attr(o.flame, { rx: (fa * 48).toFixed(1), ry: (fa * Math.max(8, (crown - F.roof) * 0.7)).toFixed(1), cy: (F.roof + (crown - F.roof) * 0.35).toFixed(1), 'fill-opacity': fa.toFixed(2) });
      const sk = strokeOf(th);
      attr(o.chipR, { fill: STROKE_COL[sk] });
      o.chip.textContent = STROKES[sk];
      o.selR.style.display = i === this.cyl ? '' : 'none';
    }

    // ---------- corte transversal ----------
    this.updateSection(st, P, local[this.cyl], combOn && (this.cyl + 1) !== P.failSpark, pOpt, dt, running, E);


    // ---------- escape ----------
    this.updateExhaust(st, P, local, dt, running);
  }

  updateSection(st, P, th, comb, pOpt, dt, running, E) {
    const s = this.s, { x0, yc, deck, apex } = T;
    s.title.textContent = `Cilindro ${this.cyl + 1} por dentro`;
    const sk = strokeOf(th);
    attr(s.strokeR, { fill: STROKE_COL[sk] });
    s.strokeT.textContent = STROKES[sk].toUpperCase();
    const crankDeg = th % 360;
    const k = slider(crankDeg, T.R, T.L);
    const pin = { x: x0 + k.px, y: yc + k.py };
    const ppY = yc + k.pin, crown = ppY - T.ch;
    s.crank.setAttribute('transform', `translate(${x0} ${yc}) rotate(${crankDeg.toFixed(1)})`);
    s.piston.setAttribute('transform', `translate(0 ${crown.toFixed(1)})`);
    attr(s.pinC, { cx: pin.x.toFixed(1), cy: pin.y.toFixed(1) });
    const dx = pin.x - x0, dy = pin.y - ppY, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    s.rod.setAttribute('d', `M${x0 + nx * 7} ${ppY + ny * 7} L${pin.x + nx * 11} ${pin.y + ny * 11} L${pin.x - nx * 11} ${pin.y - ny * 11} L${x0 - nx * 7} ${ppY - ny * 7} Z`);

    const p = cylPressure(th, { ...pOpt, comb: comb ? 1 : 0 });
    s.gas.setAttribute('d', `M${x0 - 54} ${crown + 2} V${deck} L${x0} ${apex} L${x0 + 54} ${deck} V${crown + 2} Z`);
    s.gas.setAttribute('fill', gasColor(p));
    s.vP.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
    s.vP.setAttribute('y', Math.max(deck + 18, Math.min(crown - 6, deck + 44)).toFixed(0));

    // válvulas e comandos
    const li = intakeLift(th, st.cam, E) * 11.2 * T.s, le = exhaustLift(th, E) * VALVES.exh.lift * T.s;
    s.vIn.setAttribute('transform', `translate(${(-T.uIn.x * li).toFixed(1)} ${(-T.uIn.y * li).toFixed(1)})`);
    s.vEx.setAttribute('transform', `translate(${(-T.uEx.x * le).toFixed(1)} ${(-T.uEx.y * le).toFixed(1)})`);
    const camRot = (c, u, peak, a) => {
      const toF = Math.atan2(-u.y, -u.x) / D2R; // aponta para o tucho
      c.rot.setAttribute('transform', `translate(${c.c.x} ${c.c.y}) rotate(${(toF + (a - peak) / 2).toFixed(1)})`);
    };
    const pkIn = st.cam > 0.5 ? (VALVES.full.ivo + VALVES.full.ivc) / 2 : (VALVES.part.ivo + VALVES.part.ivc) / 2;
    camRot(s.camIn, T.uIn, pkIn, th);
    camRot(s.camEx, T.uEx, (VALVES.exh.evo + VALVES.exh.evc) / 2, th);
    s.camMode.textContent = `ShiftCam: ressalto ${st.cam > 0.5 ? 'pleno' : 'parcial'}`;

    // vela, chama, injeção
    const ds = th - (360 - st.adv);
    s.spark.setAttribute('r', running && comb && ds >= 0 && ds < 14 ? 9 : 0);
    const xb = comb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
    const fa = comb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
    attr(s.flame, { r: (fa * 70).toFixed(1), cy: (apex + 14 + (crown - apex) * 0.25).toFixed(1), 'fill-opacity': fa.toFixed(2) });
    const inj = running && !st.cut.any && th > 640 && th < 720 + 0 || (running && !st.cut.any && th < 110);
    s.spray.setAttribute('fill-opacity', inj ? (0.35 + 0.5 * st.tps).toFixed(2) : 0);

    // gás nos dutos: admissão = pressão do coletor, escape = temperatura
    const mapBar = st.pr * 1.013;
    s.inGas.setAttribute('stroke', gasColor(mapBar));
    s.exGas.setAttribute('stroke', tempColor(st.temp.egt, 20, 1000));
    const vr = st.vis.rpm / 60 * 360;
    this.flowIn -= (intakeLift(th, st.cam, E) > 0.05 ? 1 : 0.12 * (1 - st.pr)) * Math.min(400, vr * 0.12 + 20) * dt;
    this.flowEx -= (exhaustLift(th, E) > 0.05 ? 1 : 0.15) * Math.min(400, vr * 0.12 + 20) * dt;
    if (!running && st.rpm < 30) { this.flowIn += 0; }
    s.inFlow.setAttribute('stroke-dashoffset', (this.flowIn % 14).toFixed(1));
    s.exFlow.setAttribute('stroke-dashoffset', (this.flowEx % 14).toFixed(1));
    s.inFlow.style.opacity = st.rpm > 30 ? 1 : 0;
    s.exFlow.style.opacity = st.rpm > 30 ? 1 : 0;
    s.butterfly.setAttribute('transform', `rotate(${(8 + st.tps * 82).toFixed(1)} 855 172)`);
    s.filter.setAttribute('stroke', P.failFilter ? '#7a5a2a' : '#c9b26a');
    s.filter.setAttribute('fill', P.failFilter ? '#4a3a20' : 'none');
    const wc = tempColor(st.temp.coolant, 20, 125);
    s.water.forEach((w) => w.setAttribute('fill', wc));
    const oy = yc + 40;
    let od = `M${x0 - 96} ${oy}`;
    for (let x = x0 - 96; x <= x0 + 96; x += 12) od += ` L${x} ${oy + Math.sin(x * 0.09 + this.oilPh * 3) * (1 + st.rpm / 6000)}`;
    s.oil.setAttribute('d', `${od} V${yc + 52} Q${x0 + 96} ${yc + 60} ${x0 + 76} ${yc + 60} H${x0 - 76} Q${x0 - 96} ${yc + 60} ${x0 - 96} ${yc + 52} Z`);
    s.vMap.textContent = `${Math.round(st.pr * 101.3)} kPa`;
    s.vEgt.textContent = `${Math.round(st.temp.egt)} °C`;
    s.vTps.textContent = `${Math.round(st.tps * 100)}%`;
  }

  updateExhaust(st, P, local, dt, running) {
    const e = this.e;
    const E = profile(P);
    if (e.kind !== mufKey(P)) { e.kind = mufKey(P); Object.assign(e, drawMuffler(e.muf, P, 1230, 742, true)); }
    e.mufName.textContent = P.muffler === false ? 'sem silencioso: tubo direto' : P.baffle > 0.75 ? 'silencioso original com válvula' : P.baffle > 0.3 ? 'ponteira esportiva' : 'ponteira aberta, quase sem miolo';
    const col = tempColor(st.temp.egt, 20, 1000);
    e.core.forEach((c) => c.setAttribute('stroke', col));
    // pulso de cada cilindro: nasce na abertura do escape e corre pelo tubo
    for (let i = 0; i < 4; i++) {
      const th = local[i];
      let u = (th - 494) / 226;
      if (th < 494) u = (th + 720 - 494) / 226;
      const c = e.pulses[i];
      if (u >= 0 && u <= 1 && st.rpm > 30) {
        const m = e.meas[i], L = m.getTotalLength();
        const pt = m.getPointAtLength(u * L);
        const strong = running && st.comb > 0 && !st.cut.any && (i + 1) !== P.failSpark;
        attr(c, { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: (strong ? 6 + 3 * st.pr : 3.5) * (1 - 0.4 * u), 'fill-opacity': strong ? 0.95 : 0.4 });
      } else c.setAttribute('r', 0);
    }
    if (e.flap) e.flap.setAttribute('transform', `rotate(${flapOpen(st, P, E) ? 80 : 0} ${e.flapX} 742)`);
    // ondas de som saindo da ponteira
    const loud = running ? Math.min(1, 0.25 + st.pr * 0.5 + st.rpm / 30000) * (0.8 + 0.4 * (P.muffler === false ? 1.2 : 1 - P.baffle)) : 0;
    this.waveT += dt * (0.8 + st.vis.rpm / 120);
    if (loud > 0 && this.waveT > 0.35) {
      this.waveT = 0;
      this.waves.push({ r: 4, a: loud });
      if (this.waves.length > 5) this.waves.shift();
    }
    while (e.waves.childNodes.length < this.waves.length) el('path', { fill: 'none', stroke: '#9fd0ff', 'stroke-width': 1.5 }, e.waves);
    const tx = e.tail, ty = 742;
    this.waves.forEach((w, k) => {
      w.r += dt * 40; w.a *= Math.exp(-dt * 1.4);
      const n = e.waves.childNodes[k];
      n.setAttribute('d', `M${tx + w.r * 0.5} ${ty - w.r} A${w.r} ${w.r} 0 0 1 ${tx + w.r * 0.5} ${ty + w.r}`);
      n.setAttribute('stroke-opacity', Math.max(0, w.a * (1 - w.r / 40)).toFixed(2));
    });
    for (let k = this.waves.length; k < e.waves.childNodes.length; k++) e.waves.childNodes[k].setAttribute('stroke-opacity', 0);
  }
}

export { fmtInt };
