// Desenho do V-Twin 45° (SVG), usado pelo Scene quando o motor escolhido é o 'v2'.
// Regiões da cena (1400 × 784):
//   esquerda  – corte lateral do motor: os dois cilindros em V, volantes com um moente só, comando no cárter,
//               tuchos, varetas e balancins, filtro de ar no meio do V e os dois escapamentos
//   direita   – "O ritmo do V-Twin": os pulsos do escape ao longo de 1.440°, comparados com um 4 em linha
//   embaixo   – escapamento (a roda do ciclo é desenhada pelo Scene)
// Cada cilindro é desenhado "em pé" num grupo girado de ±22,5° em volta do eixo do virabrequim.
import { el, txt, attr, gasColor, tempColor, fmt, fmtInt } from './svg.js';
import { ENGINES } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, strokeOf } from '../sim/engine.js';
import { drawMuffler, mufKey } from './exhaust-common.js';

const E = ENGINES.v2;
const D2R = Math.PI / 180;
const STROKES = ['Admissão', 'Compressão', 'Explosão', 'Escape'];
const STROKE_COL = ['#3d7fe0', '#2bb39a', '#f08a2c', '#8b7d70'];

const C = { x: 350, y: 572 };
const S = 1.12;
const G = {
  R: (E.stroke / 2) * S, L: E.rod * S, ch: E.ch * S, bh: 74 * S, hb: (E.bore / 2) * S,
};
G.crownTdc = G.R + G.L + G.ch;
G.deck = G.crownTdc + 2;
G.dome = G.deck + 26;
G.headTop = G.deck + 105;
G.coverTop = G.headTop + 36;
const CYL = [
  { a: -22.5, sIn: 1, name: 'dianteiro' },
  { a: 22.5, sIn: -1, name: 'traseiro' },
];

// ponto local (u para o lado, v ao longo do cilindro) → tela
function W(u, v, a) {
  const r = a * D2R, c = Math.cos(r), s = Math.sin(r);
  return { x: C.x + u * c + v * s, y: C.y + u * s - v * c };
}
const P2 = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const lx = (u) => C.x + u, ly = (v) => C.y - v;   // coordenadas dentro do grupo girado

export class V2View {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.build();
    this.flowIn = 0; this.flowEx = 0; this.chain = 0; this.oilPh = 0;
  }

  // ======================================================================
  build() {
    const g = this.g;
    const m = this.m = { cyl: [] };
    txt(g, 24, 40, 'O V-Twin por dentro', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    m.order = txt(g, 24, 64, '', { 'font-size': 14, fill: '#8da0b6' });
    m.slow = txt(g, 680, 40, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    // escapamentos (atrás de tudo)
    const ex = el('g', { 'data-comp': 'header' }, g);
    const pf = W(-G.hb - 4, G.deck + 42, CYL[0].a), pr = W(G.hb + 4, G.deck + 42, CYL[1].a);
    m.exPaths = [
      `M${P2(pf)} C${pf.x - 60} ${pf.y + 20} ${86} ${pf.y + 70} ${84} ${C.y - 20} C${82} ${C.y + 120} ${120} ${C.y + 170} ${230} ${C.y + 172} L${700} ${C.y + 176}`,
      `M${P2(pr)} C${pr.x + 60} ${pr.y + 20} ${618} ${pr.y + 80} ${616} ${C.y + 10} C${614} ${C.y + 90} ${640} ${C.y + 130} ${700} ${C.y + 140}`,
    ];
    m.exPaths.forEach((d) => el('path', { d, fill: 'none', stroke: '#5b6d82', 'stroke-width': 30, 'stroke-linecap': 'round' }, ex));
    m.exGas = m.exPaths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 24, 'stroke-linecap': 'round', class: 'L-gas' }, ex));
    m.exFlow = m.exPaths.map((d) => el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g));

    // cárter
    const A = W(-G.hb - 10, 175, CYL[0].a), B = W(G.hb + 10, 175, CYL[0].a), Cc = W(-G.hb - 10, 175, CYL[1].a), D = W(G.hb + 10, 175, CYL[1].a);
    const cc = el('g', { 'data-comp': 'crankcase' }, g);
    el('path', { d: `M${P2(A)} L${P2(B)} L${P2(Cc)} L${P2(D)} C${C.x + 165} ${C.y - 70} ${C.x + 160} ${C.y + 110} ${C.x + 95} ${C.y + 140} L${C.x - 95} ${C.y + 140} C${C.x - 160} ${C.y + 110} ${C.x - 165} ${C.y - 70} ${P2(A)} Z`,
      fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, cc);
    m.oil = el('path', { fill: '#b5832a', 'fill-opacity': 0.75, 'data-comp': 'oil' }, g);

    // corrente do comando (do virabrequim ao comando)
    m.camC = { x: C.x, y: C.y - 152 };
    m.chainEl = el('line', { x1: C.x, y1: C.y, x2: m.camC.x, y2: m.camC.y, stroke: '#9aa7b6', 'stroke-width': 3, 'stroke-dasharray': '3 3', 'data-comp': 'camV2' }, g);

    // volantes (virabrequim) com um moente só
    const fw = el('g', { 'data-comp': 'crank' }, g);
    m.fly = el('g', {}, fw);
    el('circle', { cx: C.x, cy: C.y, r: 104, fill: '#3a4554', stroke: '#8a98a8', 'stroke-width': 1.2 }, m.fly);
    el('path', { d: `M${C.x - 92} ${C.y + 48} A104 104 0 0 0 ${C.x + 92} ${C.y + 48} L${C.x + 40} ${C.y + 18} A44 44 0 0 1 ${C.x - 40} ${C.y + 18} Z`, fill: '#4f5d6e', stroke: '#2b3542', 'stroke-width': 1 }, m.fly);
    el('circle', { cx: C.x, cy: C.y - G.R, r: 17, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, m.fly);
    for (const a of [40, 140, 220, 320]) {
      const p = { x: C.x + 74 * Math.sin(a * D2R), y: C.y - 74 * Math.cos(a * D2R) };
      el('circle', { cx: p.x, cy: p.y, r: 6, fill: '#2b3542' }, m.fly);
    }
    el('circle', { cx: C.x, cy: C.y, r: 20, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, fw);

    // comando único com 4 ressaltos
    const cam = el('g', { 'data-comp': 'camV2' }, g);
    m.cam = el('g', {}, cam);
    const lobe = (ang) => {
      const pts = [];
      for (let a = 0; a < 360; a += 8) {
        const d = ((a - ang + 540) % 360) - 180;
        const nose = Math.abs(d) < 55 ? Math.cos(d / 55 * Math.PI / 2) ** 2 : 0;
        const r = 17 + 10 * nose;
        pts.push(`${(m.camC.x + r * Math.sin(a * D2R)).toFixed(1)},${(m.camC.y - r * Math.cos(a * D2R)).toFixed(1)}`);
      }
      return pts.join(' ');
    };
    for (const a of [0, 95, 180, 275]) el('polygon', { points: lobe(a), fill: '#a6795b', 'fill-opacity': 0.55, stroke: '#2b3542', 'stroke-width': 0.8 }, m.cam);
    el('circle', { cx: m.camC.x, cy: m.camC.y, r: 6, fill: '#2b3542' }, m.cam);

    // cilindros
    for (let i = 0; i < 2; i++) m.cyl.push(this.buildCyl(g, i));

    // bielas (no mundo): a dianteira é o "garfo", a traseira é a "lâmina"
    m.rods = [el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, g),
      el('path', { fill: '#a3adba', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, g)];
    m.pin = el('circle', { r: 14, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1.2, 'data-comp': 'rod' }, g);

    // admissão: corpo de borboleta visto de frente, dentro do filtro de ar, e coletor em Y
    const ia = el('g', { 'data-comp': 'intake' }, g);
    const tb = this.tb = { x: C.x, y: C.y - 372 };
    const portF = W(G.hb + 6, G.deck + 50, CYL[0].a), portR = W(-G.hb - 6, G.deck + 50, CYL[1].a);
    m.inPath = `M${P2(portF)} Q${tb.x - 30} ${tb.y + 26} ${tb.x} ${tb.y} Q${tb.x + 30} ${tb.y + 26} ${P2(portR)}`;
    el('path', { d: m.inPath, fill: 'none', stroke: '#5b6d82', 'stroke-width': 30, 'stroke-linecap': 'round' }, ia);
    m.inGas = el('path', { d: m.inPath, fill: 'none', 'stroke-width': 24, 'stroke-linecap': 'round', class: 'L-gas' }, ia);
    m.inFlow = el('path', { d: `M${tb.x} ${tb.y} Q${tb.x - 30} ${tb.y + 26} ${P2(portF)} M${tb.x} ${tb.y} Q${tb.x + 30} ${tb.y + 26} ${P2(portR)}`, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g);
    const af = el('g', { 'data-comp': 'airbox' }, g);
    el('circle', { cx: tb.x, cy: tb.y - 4, r: 58, fill: '#1b2430', 'fill-opacity': 0.55, stroke: '#9aa7b6', 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, af);
    m.filter = el('circle', { cx: tb.x, cy: tb.y - 4, r: 46, fill: 'none', stroke: '#c9b26a', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'data-comp': 'filter' }, af);
    const th = el('g', { 'data-comp': 'throttle' }, g);
    el('circle', { cx: tb.x, cy: tb.y - 4, r: 22, fill: '#0d151e', stroke: '#e6edf3', 'stroke-width': 1.6 }, th);
    m.butterfly = el('ellipse', { cx: tb.x, cy: tb.y - 4, rx: 20, ry: 20, fill: '#9aa7b6', 'fill-opacity': 0.85 }, th);

    // nomes
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, t, anchor, px, py) => {
      el('path', { d: `M${anchor === 'end' ? x + 4 : x - 4} ${y - 4} L${px} ${py}`, stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6, fill: 'none' }, L);
      el('circle', { cx: px, cy: py, r: 2, fill: '#8da0b6' }, L);
      txt(L, x, y, t, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': anchor, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    };
    const f = CYL[0].a, r = CYL[1].a;
    const at = (u, v, a) => W(u, v, a);
    let p;
    p = at(-20, G.coverTop - 12, f); lab(22, 120, 'Balancim', 'start', p.x, p.y);
    p = at(-G.hb - 52, G.deck + 64, f); lab(22, 210, 'Vela (são 2)', 'start', p.x, p.y);
    p = at(-G.hb - 22, 250, f); lab(22, 300, 'Aletas', 'start', p.x, p.y);
    p = at(0, G.crownTdc - 50, f); lab(22, 350, 'Pistão', 'start', p.x, p.y);
    lab(22, 432, 'Biela', 'start', C.x - 50, C.y - 120);
    lab(22, 520, 'Volantes', 'start', C.x - 80, C.y - 30);
    lab(22, 600, 'Escape dianteiro', 'start', 86, C.y + 30);
    lab(22, 712, 'Óleo', 'start', C.x - 80, C.y + 128);
    p = at(G.hb + 46, 300, r); lab(690, 300, 'Varetas', 'end', p.x - 10, p.y);
    lab(690, 400, 'Tuchos e comando', 'end', m.camC.x + 30, m.camC.y);
    lab(690, 160, 'Filtro de ar', 'end', tb.x + 56, tb.y - 30);
    lab(690, 230, 'Coletor de admissão', 'end', tb.x + 46, tb.y + 30);
    lab(690, 560, 'Escape traseiro', 'end', 616, C.y);
    m.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    const vt = (x, y, a = 'middle') => txt(m.vals, x, y, '', { 'font-size': 12.5, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    m.vMap = vt(tb.x, tb.y + 52);
    m.vEgt = vt(84, C.y + 70);

    this.buildRhythm(el('g', {}, g));
    this.buildExhaust(el('g', { transform: 'translate(-240 0)' }, g));
  }

  buildCyl(g, i) {
    const c = CYL[i], o = { c };
    const outer = el('g', { 'data-cyl': i }, g);
    const cg = el('g', { transform: `rotate(${c.a} ${C.x} ${C.y})` }, outer);
    const hb = G.hb;
    // aletas do cilindro e do cabeçote
    const fins = el('g', { 'data-comp': 'fins' }, cg);
    for (let v = 186; v < G.deck - 4; v += 11) el('rect', { x: lx(-hb - 30), y: ly(v + 3), width: 2 * hb + 60, height: 4, rx: 2, fill: '#3b4757' }, fins);
    for (let v = G.deck + 8; v < G.headTop - 6; v += 11) el('rect', { x: lx(-hb - 36), y: ly(v + 3), width: 2 * hb + 72, height: 4, rx: 2, fill: '#46525f' }, fins);
    // cilindro (camisa) e cabeçote
    el('rect', { x: lx(-hb - 9), y: ly(G.deck), width: 2 * hb + 18, height: G.deck - 175, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'cylinder' }, cg);
    el('rect', { x: lx(-hb), y: ly(G.deck), width: 2 * hb, height: G.deck - 175, fill: '#151d27' }, cg);
    el('path', { d: `M${lx(-hb - 14)} ${ly(G.deck)} V${ly(G.headTop - 10)} Q${lx(-hb - 14)} ${ly(G.headTop)} ${lx(-hb)} ${ly(G.headTop)} H${lx(hb)} Q${lx(hb + 14)} ${ly(G.headTop)} ${lx(hb + 14)} ${ly(G.headTop - 10)} V${ly(G.deck)} Z`,
      fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'head' }, cg);
    // tampa dos balancins (em corte, transparente)
    const ca = c.sIn > 0 ? -hb - 4 : -hb - 58, cb = c.sIn > 0 ? hb + 58 : hb + 4;
    el('path', { d: `M${lx(ca)} ${ly(G.headTop)} V${ly(G.coverTop - 12)} Q${lx(ca)} ${ly(G.coverTop)} ${lx(ca + 14)} ${ly(G.coverTop)} H${lx(cb - 14)} Q${lx(cb)} ${ly(G.coverTop)} ${lx(cb)} ${ly(G.coverTop - 12)} V${ly(G.headTop)} Z`,
      fill: '#c9d1da', 'fill-opacity': 0.08, stroke: '#9aa7b6', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'data-comp': 'rocker' }, cg);
    // câmara (cúpula) e gás
    o.gas = el('path', { 'data-comp': 'chamber', class: 'L-gas' }, cg);
    o.flame = el('ellipse', { cx: lx(0), cy: ly(G.dome - 10), rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, cg);
    // válvulas: admissão do lado do V, escape do lado de fora
    const s = c.sIn;
    const valve = (side, comp, col) => {
      const v = el('g', { 'data-comp': comp }, cg);
      const x0 = lx(side * 26), y0 = ly(G.dome - 8);
      const tilt = side * 8;
      const gg = el('g', { transform: `rotate(${tilt} ${x0} ${y0})` }, v);
      el('path', { d: `M${x0 - 21} ${y0} L${x0 + 21} ${y0} L${x0 + 3} ${y0 - 8} V${y0 - 100} H${x0 - 3} V${y0 - 8} Z`, fill: col, stroke: '#2b3542', 'stroke-width': 0.9 }, gg);
      el('path', { d: Array.from({ length: 7 }, (_, k) => `M${x0 - 9} ${y0 - 92 + k * 4.5} l18 2.2`).join(' '), stroke: '#8fa0b2', 'stroke-width': 1.3, fill: 'none' }, gg);
      return { g: v, tilt, x0, y0 };
    };
    o.vIn = valve(s, 'valveIn', '#9db6d8');
    o.vEx = valve(-s, 'valveEx', '#c9b2a0');
    // balancins: vareta empurra uma ponta, a outra abre a válvula
    o.rockIn = el('path', { fill: 'none', stroke: '#c3cad4', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-comp': 'rocker' }, cg);
    o.rockEx = el('path', { fill: 'none', stroke: '#aab4c0', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-comp': 'rocker' }, cg);
    o.piv = [el('circle', { r: 4.5, fill: '#2b3542', 'data-comp': 'rocker' }, cg), el('circle', { r: 4.5, fill: '#2b3542', 'data-comp': 'rocker' }, cg)];
    // varetas e tuchos (do lado do V, paralelas ao cilindro)
    o.rods = [0, 1].map((k) => el('line', { stroke: k ? '#d7dde4' : '#b8c2cc', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'data-comp': 'pushrod' }, cg));
    o.lift = [0, 1].map(() => el('rect', { width: 14, height: 20, rx: 3, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 0.9, 'data-comp': 'lifter' }, cg));
    // vela (do lado de fora)
    const sp = el('g', { 'data-comp': 'spark' }, cg);
    const spx = lx(-s * (hb + 22)), spy = ly(G.deck + 60);
    el('rect', { x: spx - 4, y: spy - 30, width: 8, height: 38, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8, transform: `rotate(${-s * 50} ${spx} ${spy})` }, sp);
    o.spark = el('circle', { cx: lx(-s * 34), cy: ly(G.dome - 4), r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, cg);
    // pistão
    o.piston = el('g', { 'data-comp': 'piston' }, cg);
    el('path', { d: `M${lx(-hb + 2)} 4 Q${lx(0)} -8 ${lx(hb - 2)} 4 V${G.bh} H${lx(-hb + 2)} Z`, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    for (const yy of [9, 15, 21]) el('line', { x1: lx(-hb + 2), y1: yy, x2: lx(hb - 2), y2: yy, stroke: '#4f5b69', 'stroke-width': 1 }, o.piston);
    el('circle', { cx: lx(0), cy: G.ch, r: 10, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    // rótulo do tempo acima do cabeçote
    const top = W(0, G.coverTop + 46, c.a);
    o.chipR = el('rect', { x: top.x - 102, y: top.y - 15, width: 204, height: 26, rx: 13, 'data-cyl': i }, outer);
    o.chip = txt(outer, top.x, top.y + 4, '', { 'font-size': 13, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' });
    o.pv = txt(outer, top.x, top.y + 32, '', { 'font-size': 12.5, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'var(--mono)', class: 'L-values', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    return o;
  }

  // ---------------------------------------------------------------- ritmo
  buildRhythm(g) {
    const r = this.r = {};
    txt(g, 724, 40, 'O ritmo do V-Twin', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3', 'data-comp': 'rhythm' });
    txt(g, 724, 64, 'Pulsos no escape ao longo de duas voltas do ciclo (1.440°). O mais novo fica à direita.', { 'font-size': 13.5, fill: '#8da0b6' });
    const strip = (y, title, col) => {
      const s = { x0: 734, x1: 1376, y0: y, h: 128, col };
      txt(g, s.x0, y - 10, title, { 'font-size': 14, 'font-weight': 700, fill: col });
      el('rect', { x: s.x0, y, width: s.x1 - s.x0, height: s.h, rx: 10, fill: '#0d151e', stroke: '#263446' }, g);
      for (let k = 0; k <= 8; k++) el('line', { x1: s.x0 + (k / 8) * (s.x1 - s.x0), y1: y, x2: s.x0 + (k / 8) * (s.x1 - s.x0), y2: y + s.h, stroke: '#fff', 'stroke-opacity': 0.04 }, g);
      s.area = el('path', { fill: col, 'fill-opacity': 0.25, stroke: col, 'stroke-width': 1.8 }, g);
      s.marks = el('g', {}, g);
      s.labels = [];
      for (let k = 0; k < 10; k++) s.labels.push(txt(g, 0, 0, '', { 'font-size': 12.5, 'font-weight': 700, fill: '#e6edf3', 'text-anchor': 'middle', 'font-family': 'var(--mono)' }));
      return s;
    };
    r.v2 = strip(118, 'V-Twin 45° · explosões a 315° e 405°: "batata-batata"', '#f08a2c');
    r.i4 = strip(318, '4 em linha no mesmo giro · uma explosão a cada 180°: zumbido contínuo', '#8da0b6');
    r.now = el('line', { x1: 1376, y1: 108, x2: 1376, y2: 456, stroke: '#fff', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, g);
    r.note = txt(g, 724, 486, '', { 'font-size': 14, fill: '#e6edf3' });
    r.note2 = txt(g, 724, 508, '', { 'font-size': 13, fill: '#8da0b6' });
  }

  drawStrip(s, theta, fires, decay, amp, rpm, alive, short = false) {
    const W2 = 1440, n = 160, x0 = s.x0, x1 = s.x1, base = s.y0 + s.h - 12, H = s.h - 30;
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const phi = theta - W2 + (k / n) * W2;
      let y = 0;
      for (const fz of fires) {
        let d = ((phi - fz.at) % 720 + 720) % 720;
        if (d < 360 && fz.on) y += fz.a * (d < 6 ? d / 6 : Math.exp(-(d - 6) / decay));
      }
      pts.push(`${(x0 + (k / n) * (x1 - x0)).toFixed(1)},${(base - Math.min(1.15, y) * H * amp).toFixed(1)}`);
    }
    s.area.setAttribute('d', `M${x0} ${base} L${pts.join(' L')} L${x1} ${base} Z`);
    // marcas das explosões e intervalos (em graus e milissegundos)
    const ev = [];
    for (const fz of fires) {
      for (let m = -3; m <= 1; m++) {
        const phi = fz.at + 720 * m + Math.floor(theta / 720) * 720;
        if (phi > theta - W2 && phi <= theta) ev.push({ phi, on: fz.on });
      }
    }
    ev.sort((a, b) => a.phi - b.phi);
    const X = (phi) => x0 + ((phi - (theta - W2)) / W2) * (x1 - x0);
    let li = 0;
    for (let k = 1; k < ev.length && li < s.labels.length; k++) {
      const d = ev[k].phi - ev[k - 1].phi;
      const xm = (X(ev[k].phi) + X(ev[k - 1].phi)) / 2;
      if (xm < x0 + 24 || xm > x1 - 24) continue;
      const lb = s.labels[li++];
      attr(lb, { x: xm.toFixed(1), y: s.y0 + 18 });
      lb.textContent = alive && rpm > 50 && !short ? `${Math.round(d)}° · ${fmt(d / (6 * rpm) * 1000, 0)} ms` : `${Math.round(d)}°`;
      lb.style.display = '';
    }
    for (; li < s.labels.length; li++) s.labels[li].style.display = 'none';
  }

  // ---------------------------------------------------------------- escapamento
  buildExhaust(g) {
    const e = this.e = {};
    const gg = el('g', { 'data-comp': 'exhaustSys' }, g);
    txt(gg, 990, 558, 'Escapamento', { 'font-size': 15, 'font-weight': 700, fill: '#e6edf3' });
    e.name = txt(gg, 990, 576, '', { 'font-size': 12, fill: '#8da0b6' });
    e.paths = [
      'M1010 604 C1010 700 1040 742 1100 742 L1230 742',
      'M1070 604 C1070 650 1090 700 1130 700 L1230 700',
    ];
    e.pipes = e.paths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round', stroke: '#5b6d82' }, gg));
    e.core = e.paths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', class: 'L-gas' }, gg));
    e.meas = e.paths.map((d) => el('path', { d, fill: 'none', stroke: 'none' }, gg));
    e.cross = el('path', { d: 'M1150 700 L1150 742', stroke: '#5b6d82', 'stroke-width': 10 }, gg);
    txt(gg, 1010, 596, 'D', { 'font-size': 12, 'font-weight': 700, fill: '#aebdcc', 'text-anchor': 'middle' });
    txt(gg, 1070, 596, 'T', { 'font-size': 12, 'font-weight': 700, fill: '#aebdcc', 'text-anchor': 'middle' });
    e.muf = [el('g', { 'data-comp': 'muffler' }, gg), el('g', { 'data-comp': 'muffler' }, gg)];
    e.pulses = [0, 1].map(() => el('circle', { r: 0, fill: '#fff2c4', filter: 'url(#glow)', 'pointer-events': 'none' }, gg));
    e.waves = el('g', { 'pointer-events': 'none' }, gg);
    e.kind = null;
    e.wv = []; e.wt = 0;
  }

  // ======================================================================
  update(st, P, dt) {
    const m = this.m;
    const theta = st.vis.theta;
    const off = E.firing.v45;
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const pOpt = { pr: st.pr, adv: st.adv, cr: P.cr, lambda: st.lambda, E };
    const local = off.map((o) => ((theta - o) % 720 + 720) % 720);
    m.order.textContent = 'Dianteiro explode, 315° depois o traseiro, 405° depois o dianteiro de novo';
    const vr = st.vis.rpm;
    m.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `animação em câmera lenta · 1:${Math.round(st.rpm / Math.max(1, vr))}`;

    // virabrequim: um moente só para as duas bielas
    const psiF = local[0] % 360;
    const phiW = CYL[0].a + psiF;
    m.fly.setAttribute('transform', `rotate(${phiW.toFixed(1)} ${C.x} ${C.y})`);
    const pin = { x: C.x + G.R * Math.sin(phiW * D2R), y: C.y - G.R * Math.cos(phiW * D2R) };
    attr(m.pin, { cx: pin.x.toFixed(1), cy: pin.y.toFixed(1) });
    m.cam.setAttribute('transform', `rotate(${(theta / 2).toFixed(1)} ${m.camC.x} ${m.camC.y})`);
    this.chain = (this.chain + dt * vr * 0.6) % 6;
    m.chainEl.setAttribute('stroke-dashoffset', -this.chain);

    for (let i = 0; i < 2; i++) {
      const o = m.cyl[i], c = CYL[i], th = local[i];
      const psi = th % 360, a = psi * D2R;
      const vpp = G.R * Math.cos(a) + Math.sqrt(G.L * G.L - (G.R * Math.sin(a)) ** 2);
      const crown = vpp + G.ch;
      o.piston.setAttribute('transform', `translate(0 ${ly(crown).toFixed(1)})`);
      // biela no mundo
      const pp = W(0, vpp, c.a);
      const dx = pp.x - pin.x, dy = pp.y - pin.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const wb = i === 0 ? 14 : 9, ws = i === 0 ? 8 : 6;
      m.rods[i].setAttribute('d', `M${pp.x + nx * ws} ${pp.y + ny * ws} L${pin.x + nx * wb} ${pin.y + ny * wb} L${pin.x - nx * wb} ${pin.y - ny * wb} L${pp.x - nx * ws} ${pp.y - ny * ws} Z`);
      // gás
      const cmb = combOn && (i + 1) !== P.failSpark ? 1 : 0;
      const p = cylPressure(th, { ...pOpt, comb: cmb });
      o.gas.setAttribute('d', `M${lx(-G.hb)} ${ly(crown - 3)} V${ly(G.deck)} Q${lx(0)} ${ly(G.dome + 18)} ${lx(G.hb)} ${ly(G.deck)} V${ly(crown - 3)} Z`);
      o.gas.setAttribute('fill', gasColor(p));
      o.pv.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
      // válvulas, balancins, varetas, tuchos
      const li = intakeLift(th, 1, E) * 12.6 * S, le = exhaustLift(th, E) * 12.6 * S;
      const vmove = (v, l) => v.g.setAttribute('transform', `translate(${(-Math.sin(v.tilt * D2R) * -l * 0).toFixed(1)} ${l.toFixed(1)})`);
      vmove(o.vIn, li); vmove(o.vEx, le);
      const s = c.sIn;
      const rock = (el2, piv, pushU, valveU, pivU, pivV, l, pk) => {
        const pushY = ly(G.headTop + 8) - l * 0.55, valveY = ly(G.dome + 96) + l;
        el2.setAttribute('d', `M${lx(pushU)} ${pushY.toFixed(1)} L${lx(pivU)} ${ly(pivV)} L${lx(valveU)} ${valveY.toFixed(1)}`);
        attr(piv, { cx: lx(pivU), cy: ly(pivV) });
        void pk;
      };
      rock(o.rockIn, o.piv[0], s * (G.hb + 34), s * 26, s * (G.hb + 4), G.headTop + 22, li);
      rock(o.rockEx, o.piv[1], s * (G.hb + 46), -s * 26, s * 6, G.headTop + 30, le);
      const rodLine = (ln, lf, u, l) => {
        attr(ln, { x1: lx(u), y1: (ly(G.headTop + 8) - l * 0.55).toFixed(1), x2: lx(u), y2: (ly(168) - l * 0.55).toFixed(1) });
        attr(lf, { x: lx(u) - 7, y: (ly(168) - l * 0.55).toFixed(1) });
      };
      rodLine(o.rods[0], o.lift[0], s * (G.hb + 34), li);
      rodLine(o.rods[1], o.lift[1], s * (G.hb + 46), le);
      // vela e chama (duas velas por cilindro: disparam juntas)
      const ds = th - (360 - st.adv);
      o.spark.setAttribute('r', running && cmb && ds >= 0 && ds < 16 ? 8 : 0);
      const xb = cmb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 62), 3)) : 0;
      const fa = cmb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 430) / 90)) : 0;
      attr(o.flame, { rx: (fa * 56).toFixed(1), ry: (fa * Math.max(10, (crown > 0 ? (G.dome - crown) * 0.6 : 10))).toFixed(1), cy: ly(G.dome - 14 - fa * 10).toFixed(1), 'fill-opacity': fa.toFixed(2) });
      const sk = strokeOf(th);
      attr(o.chipR, { fill: STROKE_COL[sk] });
      o.chip.textContent = `${c.name} · ${STROKES[sk]}`;
    }

    // admissão, escape, óleo
    const mapBar = st.pr * 1.013;
    m.inGas.setAttribute('stroke', gasColor(mapBar));
    const ec = tempColor(st.temp.egt, 20, 1000);
    m.exGas.forEach((x) => x.setAttribute('stroke', ec));
    const spd = Math.min(400, vr * 0.5 + 20);
    const openIn = intakeLift(local[0], 1, E) > 0.05 || intakeLift(local[1], 1, E) > 0.05;
    this.flowIn -= (openIn ? 1 : 0.12 * (1 - st.pr)) * spd * dt;
    m.inFlow.setAttribute('stroke-dashoffset', (this.flowIn % 14).toFixed(1));
    m.inFlow.style.opacity = st.rpm > 30 ? 1 : 0;
    m.exFlow.forEach((f, i) => {
      if (!this.flowExA) this.flowExA = [0, 0];
      this.flowExA[i] -= (exhaustLift(local[i], E) > 0.05 ? 1 : 0.12) * spd * dt;
      f.setAttribute('stroke-dashoffset', (this.flowExA[i] % 14).toFixed(1));
      f.style.opacity = st.rpm > 30 ? 1 : 0;
    });
    // borboleta vista de frente: aberta = disco de lado (estreito)
    attr(m.butterfly, { rx: (20 * Math.cos(Math.min(1, 0.08 + st.tps * 0.92) * Math.PI / 2)).toFixed(1) });
    m.filter.setAttribute('stroke', P.failFilter ? '#7a5a2a' : '#c9b26a');
    m.filter.setAttribute('fill', P.failFilter ? '#4a3a20' : 'none');
    this.oilPh += dt * (1 + st.rpm / 800);
    const oy = C.y + 122;
    let od = `M${C.x - 90} ${oy}`;
    for (let x = C.x - 90; x <= C.x + 90; x += 10) od += ` L${x} ${oy + Math.sin(x * 0.09 + this.oilPh * 3) * (1 + st.rpm / 2000)}`;
    m.oil.setAttribute('d', `${od} L${C.x + 90} ${C.y + 138} H${C.x - 90} Z`);
    m.vMap.textContent = `${Math.round(st.pr * 101.3)} kPa · borboleta ${Math.round(st.tps * 100)}%`;
    m.vEgt.textContent = `${Math.round(st.temp.egt)} °C`;

    // ritmo
    const alive = running && st.comb > 0;
    const fires = off.map((o, i) => ({ at: o + 360, a: i ? 0.95 : 1, on: alive && !st.cut.any && (i + 1) !== P.failSpark }));
    const firesI4 = ENGINES.i4.firing.flat.map((o) => ({ at: o + 360, a: 0.8, on: alive }));
    this.drawStrip(this.r.v2, theta, fires, 40, 0.85, st.rpm, alive);
    this.drawStrip(this.r.i4, theta, firesI4, 40, 0.85, st.rpm, alive, true);
    if (st.rpm > 50) {
      const a = 315 / (6 * st.rpm) * 1000, b = 405 / (6 * st.rpm) * 1000, c4 = 180 / (6 * st.rpm) * 1000;
      this.r.note.textContent = `A ${fmtInt(st.rpm)} rpm: o V-Twin explode a cada ${fmt(a, 0)} ms e ${fmt(b, 0)} ms; o 4 em linha, a cada ${fmt(c4, 0)} ms.`;
      this.r.note2.textContent = st.rpm < 2000 ? 'Em giro baixo os intervalos são longos e desiguais: o ouvido separa cada explosão (o "batata-batata").' : 'Subindo o giro os pulsos se aproximam, mas o ritmo manco continua: é o ronco grave do V-Twin.';
    } else { this.r.note.textContent = 'Ligue o motor para ver os pulsos.'; this.r.note2.textContent = ''; }

    // escapamento
    const e = this.e;
    if (e.kind !== mufKey(P)) {
      e.kind = mufKey(P);
      const g0 = drawMuffler(e.muf[0], P, 1225, 700, false, 0.8);
      drawMuffler(e.muf[1], P, 1225, 742, false, 0.8);
      e.muf.forEach((m) => m.setAttribute('transform', `translate(0 0)`));
      e.tail = g0.tail;
    }
    e.name.textContent = P.muffler === false ? 'drag pipes: tubos retos, sem silencioso' : P.baffle > 0.75 ? 'silenciosos originais (2 em 2 com cruzamento)' : P.baffle > 0.3 ? 'ponteiras esportivas' : 'ponteiras abertas, quase sem miolo';
    e.core.forEach((c) => c.setAttribute('stroke', ec));
    for (let i = 0; i < 2; i++) {
      const th = local[i];
      let u = (th - E.valve.exh.evo) / 240;
      if (th < E.valve.exh.evo) u = (th + 720 - E.valve.exh.evo) / 240;
      const c = e.pulses[i];
      if (u >= 0 && u <= 1 && st.rpm > 30) {
        const mm = e.meas[i], Lm = mm.getTotalLength(), pt = mm.getPointAtLength(u * Lm);
        const strong = alive && !st.cut.any && (i + 1) !== P.failSpark;
        attr(c, { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: (strong ? 7 + 3 * st.pr : 4) * (1 - 0.4 * u), 'fill-opacity': strong ? 0.95 : 0.4 });
      } else c.setAttribute('r', 0);
    }
    const loud = running ? Math.min(1, 0.4 + st.pr * 0.5) * (0.8 + 0.4 * (P.muffler === false ? 1.2 : 1 - P.baffle)) : 0;
    e.wt += dt * (0.8 + vr / 60);
    if (loud > 0 && e.wt > 0.35) { e.wt = 0; e.wv.push({ r: 4, a: loud }); if (e.wv.length > 5) e.wv.shift(); }
    while (e.waves.childNodes.length < e.wv.length) el('path', { fill: 'none', stroke: '#9fd0ff', 'stroke-width': 1.5 }, e.waves);
    e.wv.forEach((w, k) => {
      w.r += dt * 36; w.a *= Math.exp(-dt * 1.4);
      const n = e.waves.childNodes[k], ty = 721;
      n.setAttribute('d', `M${e.tail + w.r * 0.4} ${ty - w.r} A${w.r} ${w.r} 0 0 1 ${e.tail + w.r * 0.4} ${ty + w.r}`);
      n.setAttribute('stroke-opacity', Math.max(0, w.a * (1 - w.r / 40)).toFixed(2));
    });
    for (let k = e.wv.length; k < e.waves.childNodes.length; k++) e.waves.childNodes[k].setAttribute('stroke-opacity', 0);
  }
}
