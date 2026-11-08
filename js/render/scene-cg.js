// Desenho do monocilíndrico CG 125 (SVG), usado pelo Scene quando o motor escolhido é o 'cg'.
// Regiões da cena (1400 × 784):
//   esquerda  – corte lateral: cilindro inclinado com aletas, volante do magneto, comando no cárter com
//               tuchos, varetas e balancins, carburador, escapamento, câmbio e pedal de partida
//   direita   – o carburador por dentro: venturi, gaveta, agulha, giclê, cuba com boia e afogador
//   embaixo   – escapamento (quadro de ruído e pluma são comuns)
import { el, txt, attr, gasColor, tempColor, fmt } from './svg.js';
import { ENGINES } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, strokeOf } from '../sim/engine.js';
import { drawMuffler, mufKey, ExhaustPlume } from './exhaust-common.js';
import { wrapShake } from './shake.js';

const E = ENGINES.cg;
const D2R = Math.PI / 180;
const STROKES = ['Admissão', 'Compressão', 'Explosão', 'Escape'];
const STROKE_COL = ['#3d7fe0', '#2bb39a', '#f08a2c', '#8b7d70'];

const C = { x: 330, y: 600 };
const S = 2.0;
const G = { R: (E.stroke / 2) * S, L: E.rod * S, ch: E.ch * S, bh: 45 * S, hb: (E.bore / 2) * S };
G.crownTdc = G.R + G.L + G.ch;
G.deck = G.crownTdc + 2;
G.dome = G.deck + 22;
G.headTop = G.deck + 88;
G.coverTop = G.headTop + 34;
const A = -15;   // cilindro inclinado para frente

function W(u, v, a = A) {
  const r = a * D2R, c = Math.cos(r), s = Math.sin(r);
  return { x: C.x + u * c + v * s, y: C.y + u * s - v * c };
}
const P2 = (p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
const lx = (u) => C.x + u, ly = (v) => C.y - v;

export class CGView {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.flowIn = 0; this.flowEx = 0; this.oilPh = 0; this.airPh = 0; this.kickA = 0;
    this.build();
  }

  build() {
    const g = this.g;
    const m = this.m = {};
    txt(g, 24, 40, 'A CG 125 por dentro', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    m.order = txt(g, 24, 64, 'Um cilindro só: uma explosão a cada duas voltas', { 'font-size': 14, fill: '#8da0b6' });
    m.slow = txt(g, 680, 40, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    // escapamento (atrás de tudo): sai pela frente do cabeçote e corre por baixo do motor
    const ex = el('g', { 'data-comp': 'header' }, g);
    const pf = W(-G.hb - 4, G.deck + 40);
    m.exPath = `M${P2(pf)} C${pf.x - 50} ${pf.y + 20} ${70} ${pf.y + 70} ${68} ${C.y - 40} C${66} ${C.y + 110} ${120} ${C.y + 150} ${240} ${C.y + 158} L${700} ${C.y + 164}`;
    el('path', { d: m.exPath, fill: 'none', stroke: '#5b6d82', 'stroke-width': 24, 'stroke-linecap': 'round' }, ex);
    m.exGas = el('path', { d: m.exPath, fill: 'none', 'stroke-width': 18, 'stroke-linecap': 'round', class: 'L-gas' }, ex);
    m.exFlow = el('path', { d: m.exPath, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g);

    // cárter (motor + câmbio na mesma carcaça)
    const cc = el('g', { 'data-comp': 'crankcase' }, g);
    const a1 = W(-G.hb - 10, 170), b1 = W(G.hb + 10, 170);
    el('path', { d: `M${P2(a1)} L${P2(b1)} C${C.x + 120} ${C.y - 150} ${C.x + 250} ${C.y - 110} ${C.x + 262} ${C.y - 30} C${C.x + 272} ${C.y + 60} ${C.x + 230} ${C.y + 118} ${C.x + 150} ${C.y + 124} L${C.x - 70} ${C.y + 124} C${C.x - 130} ${C.y + 118} ${C.x - 140} ${C.y + 40} ${C.x - 130} ${C.y - 30} C${C.x - 122} ${C.y - 80} ${a1.x - 10} ${a1.y + 30} ${P2(a1)} Z`,
      fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, cc);
    m.oil = el('path', { fill: '#b5832a', 'fill-opacity': 0.75, 'data-comp': 'oil' }, g);

    // câmbio: duas engrenagens que giram com a moto engatada
    const gb = el('g', { 'data-comp': 'gearbox' }, g);
    const gear = (cx, cy, r, n) => {
      const gg = el('g', {}, gb);
      const pts = [];
      for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2, rr = k % 2 ? r : r + 5; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); }
      el('polygon', { points: pts.join(' '), fill: '#4a5768', stroke: '#2b3542', 'stroke-width': 1 }, gg);
      el('circle', { cx, cy, r: 6, fill: '#2b3542' }, gg);
      return { gg, cx, cy };
    };
    m.g1 = gear(C.x + 150, C.y - 20, 30, 14);
    m.g2 = gear(C.x + 205, C.y + 32, 24, 11);

    // volante do magneto (virabrequim)
    const fw = el('g', { 'data-comp': 'crank' }, g);
    m.fly = el('g', {}, fw);
    el('circle', { cx: C.x, cy: C.y, r: 92, fill: '#3a4554', stroke: '#8a98a8', 'stroke-width': 1.2 }, m.fly);
    el('path', { d: `M${C.x - 80} ${C.y + 45} A92 92 0 0 0 ${C.x + 80} ${C.y + 45} L${C.x + 36} ${C.y + 16} A40 40 0 0 1 ${C.x - 36} ${C.y + 16} Z`, fill: '#4f5d6e', stroke: '#2b3542', 'stroke-width': 1 }, m.fly);
    el('circle', { cx: C.x, cy: C.y - G.R, r: 15, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, m.fly);
    for (const a of [60, 180, 300]) el('rect', { x: C.x + 70 * Math.sin(a * D2R) - 9, y: C.y - 70 * Math.cos(a * D2R) - 5, width: 18, height: 10, rx: 2, fill: '#7a5a2a', transform: `rotate(${a} ${C.x + 70 * Math.sin(a * D2R)} ${C.y - 70 * Math.cos(a * D2R)})` }, m.fly);
    el('circle', { cx: C.x, cy: C.y, r: 18, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, fw);

    // comando no cárter (engrenado ao virabrequim) e dois ressaltos
    m.camC = W(G.hb + 40, 132);
    const cam = el('g', { 'data-comp': 'camV2' }, g);
    el('line', { x1: C.x, y1: C.y, x2: m.camC.x, y2: m.camC.y, stroke: '#9aa7b6', 'stroke-width': 3, 'stroke-dasharray': '3 3' }, cam);
    m.cam = el('g', {}, cam);
    const lobe = (ang) => {
      const pts = [];
      for (let a = 0; a < 360; a += 8) {
        const d = ((a - ang + 540) % 360) - 180;
        const nose = Math.abs(d) < 55 ? Math.cos(d / 55 * Math.PI / 2) ** 2 : 0;
        const r = 16 + 9 * nose;
        pts.push(`${(m.camC.x + r * Math.sin(a * D2R)).toFixed(1)},${(m.camC.y - r * Math.cos(a * D2R)).toFixed(1)}`);
      }
      return pts.join(' ');
    };
    for (const a of [0, 120]) el('polygon', { points: lobe(a), fill: '#a6795b', 'fill-opacity': 0.6, stroke: '#2b3542', 'stroke-width': 0.8 }, m.cam);
    el('circle', { cx: m.camC.x, cy: m.camC.y, r: 5, fill: '#2b3542' }, m.cam);

    // cilindro
    this.buildCyl(g);

    // biela e moente
    m.rod = el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, g);
    m.pin = el('circle', { r: 13, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1.2, 'data-comp': 'rod' }, g);

    // carburador e filtro de ar (atrás do cabeçote)
    const port = W(G.hb + 6, G.deck + 46);
    const carb = { x: 520, y: port.y - 6 };
    m.carb = carb;
    m.inPath = `M${P2(port)} C${port.x + 30} ${port.y} ${carb.x - 50} ${carb.y} ${carb.x - 26} ${carb.y} L${carb.x + 96} ${carb.y}`;
    el('path', { d: m.inPath, fill: 'none', stroke: '#5b6d82', 'stroke-width': 30, 'stroke-linecap': 'round' }, g);
    m.inGas = el('path', { d: m.inPath, fill: 'none', 'stroke-width': 24, 'stroke-linecap': 'round', class: 'L-gas', 'data-comp': 'intake' }, g);
    m.inFlow = el('path', { d: m.inPath, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, g);
    const cb = el('g', { 'data-comp': 'carb' }, g);
    el('rect', { x: carb.x - 24, y: carb.y - 46, width: 52, height: 92, rx: 8, fill: '#2f3a47', stroke: '#9aa7b6', 'stroke-width': 1.2 }, cb);
    m.slideMini = el('rect', { x: carb.x - 10, width: 24, rx: 3, fill: '#c3cad4' }, cb);
    el('rect', { x: carb.x - 18, y: carb.y + 24, width: 40, height: 26, rx: 5, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1 }, cb);
    const af = el('g', { 'data-comp': 'airbox' }, g);
    el('rect', { x: carb.x + 70, y: carb.y - 54, width: 80, height: 108, rx: 14, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, af);
    m.filter = el('rect', { x: carb.x + 80, y: carb.y - 44, width: 60, height: 88, rx: 8, fill: 'none', stroke: '#c9b26a', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'data-comp': 'filter' }, af);

    // pedal de partida
    const kk = el('g', { 'data-comp': 'kick' }, g);
    m.kickPiv = { x: C.x + 228, y: C.y + 84 };
    m.kick = el('g', {}, kk);
    el('path', { d: `M${m.kickPiv.x} ${m.kickPiv.y} L${m.kickPiv.x + 88} ${m.kickPiv.y - 6} L${m.kickPiv.x + 92} ${m.kickPiv.y - 20}`, fill: 'none', stroke: '#c3cad4', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, m.kick);
    el('rect', { x: m.kickPiv.x + 80, y: m.kickPiv.y - 30, width: 26, height: 12, rx: 4, fill: '#20262e' }, m.kick);
    el('circle', { cx: m.kickPiv.x, cy: m.kickPiv.y, r: 9, fill: '#6f7d8e', stroke: '#2b3542' }, kk);

    // nomes
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, t, anchor, px, py) => {
      el('path', { d: `M${anchor === 'end' ? x + 4 : x - 4} ${y - 4} L${px} ${py}`, stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6, fill: 'none' }, L);
      el('circle', { cx: px, cy: py, r: 2, fill: '#8da0b6' }, L);
      txt(L, x, y, t, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': anchor, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    };
    let p;
    p = W(10, G.coverTop - 14); lab(22, 110, 'Balancins', 'start', p.x, p.y);
    p = W(-G.hb - 40, G.deck + 58); lab(22, 190, 'Vela', 'start', p.x, p.y);
    p = W(-G.hb - 22, 250); lab(22, 290, 'Aletas', 'start', p.x, p.y);
    p = W(0, G.crownTdc - 40); lab(22, 350, 'Pistão', 'start', p.x, p.y);
    lab(22, 440, 'Biela', 'start', C.x - 18, C.y - 120);
    lab(22, 520, 'Volante do magneto', 'start', C.x - 70, C.y - 20);
    lab(22, 620, 'Escapamento', 'start', 70, C.y + 20);
    lab(22, 720, 'Óleo', 'start', C.x - 40, C.y + 112);
    p = W(G.hb + 40, 280); lab(690, 250, 'Varetas', 'end', p.x + 4, p.y);
    lab(690, 420, 'Tuchos e comando', 'end', m.camC.x + 26, m.camC.y);
    lab(690, 140, 'Filtro de ar', 'end', carb.x + 110, carb.y - 54);
    lab(690, 195, 'Carburador', 'end', carb.x + 28, carb.y - 30);
    lab(690, 530, 'Câmbio', 'end', m.g1.cx + 30, m.g1.cy);
    lab(690, 640, 'Pedal de partida', 'end', m.kickPiv.x + 60, m.kickPiv.y - 6);
    m.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    m.vEgt = txt(m.vals, 68, C.y + 60, '', { 'font-size': 12.5, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });

    this.buildCarb(el('g', { class: 'noshake' }, g));
    this.buildExhaust(el('g', { transform: 'translate(-240 0)', class: 'noshake' }, g));
    this.sh = wrapShake(g);
  }

  buildCyl(g) {
    const m = this.m, hb = G.hb, o = {};
    const outer = el('g', { 'data-cyl': 0 }, g);
    const cg = el('g', { transform: `rotate(${A} ${C.x} ${C.y})` }, outer);
    const fins = el('g', { 'data-comp': 'fins' }, cg);
    for (let v = 180; v < G.deck - 4; v += 10) el('rect', { x: lx(-hb - 26), y: ly(v + 3), width: 2 * hb + 52, height: 4, rx: 2, fill: '#3b4757' }, fins);
    for (let v = G.deck + 8; v < G.headTop - 6; v += 10) el('rect', { x: lx(-hb - 32), y: ly(v + 3), width: 2 * hb + 64, height: 4, rx: 2, fill: '#46525f' }, fins);
    el('rect', { x: lx(-hb - 8), y: ly(G.deck), width: 2 * hb + 16, height: G.deck - 170, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'cylinder' }, cg);
    el('rect', { x: lx(-hb), y: ly(G.deck), width: 2 * hb, height: G.deck - 170, fill: '#151d27' }, cg);
    el('path', { d: `M${lx(-hb - 14)} ${ly(G.deck)} V${ly(G.headTop - 10)} Q${lx(-hb - 14)} ${ly(G.headTop)} ${lx(-hb)} ${ly(G.headTop)} H${lx(hb)} Q${lx(hb + 14)} ${ly(G.headTop)} ${lx(hb + 14)} ${ly(G.headTop - 10)} V${ly(G.deck)} Z`,
      fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'head' }, cg);
    el('path', { d: `M${lx(-hb - 4)} ${ly(G.headTop)} V${ly(G.coverTop - 12)} Q${lx(-hb - 4)} ${ly(G.coverTop)} ${lx(-hb + 10)} ${ly(G.coverTop)} H${lx(hb + 44)} Q${lx(hb + 58)} ${ly(G.coverTop)} ${lx(hb + 58)} ${ly(G.coverTop - 12)} V${ly(G.headTop)} Z`,
      fill: '#c9d1da', 'fill-opacity': 0.08, stroke: '#9aa7b6', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'data-comp': 'rocker' }, cg);
    o.gas = el('path', { 'data-comp': 'chamber', class: 'L-gas' }, cg);
    o.flame = el('ellipse', { cx: lx(0), cy: ly(G.dome - 10), rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, cg);
    const valve = (side, comp, col) => {
      const v = el('g', { 'data-comp': comp }, cg);
      const x0 = lx(side * 24), y0 = ly(G.dome - 8);
      const gg = el('g', { transform: `rotate(${side * 8} ${x0} ${y0})` }, v);
      el('path', { d: `M${x0 - 19} ${y0} L${x0 + 19} ${y0} L${x0 + 3} ${y0 - 8} V${y0 - 96} H${x0 - 3} V${y0 - 8} Z`, fill: col, stroke: '#2b3542', 'stroke-width': 0.9 }, gg);
      el('path', { d: Array.from({ length: 7 }, (_, k) => `M${x0 - 9} ${y0 - 88 + k * 4.5} l18 2.2`).join(' '), stroke: '#8fa0b2', 'stroke-width': 1.3, fill: 'none' }, gg);
      return { g: v };
    };
    o.vIn = valve(1, 'valveIn', '#9db6d8');
    o.vEx = valve(-1, 'valveEx', '#c9b2a0');
    o.rockIn = el('path', { fill: 'none', stroke: '#c3cad4', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-comp': 'rocker' }, cg);
    o.rockEx = el('path', { fill: 'none', stroke: '#aab4c0', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-comp': 'rocker' }, cg);
    o.piv = [el('circle', { r: 4.5, fill: '#2b3542' }, cg), el('circle', { r: 4.5, fill: '#2b3542' }, cg)];
    o.rods = [0, 1].map((k) => el('line', { stroke: k ? '#d7dde4' : '#b8c2cc', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'data-comp': 'pushrod' }, cg));
    o.lift = [0, 1].map(() => el('rect', { width: 14, height: 18, rx: 3, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 0.9, 'data-comp': 'lifter' }, cg));
    const sp = el('g', { 'data-comp': 'spark' }, cg);
    const spx = lx(-(hb + 20)), spy = ly(G.deck + 56);
    el('rect', { x: spx - 4, y: spy - 30, width: 8, height: 38, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8, transform: `rotate(-50 ${spx} ${spy})` }, sp);
    o.spark = el('circle', { cx: lx(-30), cy: ly(G.dome - 4), r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, cg);
    o.piston = el('g', { 'data-comp': 'piston' }, cg);
    el('path', { d: `M${lx(-hb + 2)} 4 Q${lx(0)} -6 ${lx(hb - 2)} 4 V${G.bh} H${lx(-hb + 2)} Z`, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    for (const yy of [8, 14, 20]) el('line', { x1: lx(-hb + 2), y1: yy, x2: lx(hb - 2), y2: yy, stroke: '#4f5b69', 'stroke-width': 1 }, o.piston);
    el('circle', { cx: lx(0), cy: G.ch, r: 10, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    const top = W(0, G.coverTop + 44);
    o.chipR = el('rect', { x: top.x - 70, y: top.y - 15, width: 140, height: 28, rx: 14 }, outer);
    o.chip = txt(outer, top.x, top.y + 4.5, '', { 'font-size': 14, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' });
    o.pv = txt(outer, top.x, top.y + 34, '', { 'font-size': 12.5, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'var(--mono)', class: 'L-values', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    m.cyl = o;
  }

  // ---------------------------------------------------------------- carburador por dentro
  buildCarb(g) {
    const c = this.c = {};
    const gg = el('g', { 'data-comp': 'carb' }, g);
    txt(gg, 724, 40, 'O carburador por dentro', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    txt(gg, 724, 64, 'O ar acelera no venturi, a pressão cai e puxa a gasolina da cuba pelo giclê.', { 'font-size': 13.5, fill: '#8da0b6' });
    // corpo: duto horizontal; o ar entra pela direita (filtro) e sai à esquerda (motor)
    const y0 = 196, y1 = 286, xm = 1010;
    c.y0 = y0; c.y1 = y1; c.xm = xm;
    el('path', { d: `M744 ${y0 - 34} H1330 V${y1 + 34} H744 Z`, fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2 }, gg);
    // duto com venturi (estreitamento no meio)
    c.bore = `M744 ${y0} L${xm - 110} ${y0} Q${xm} ${y0 + 18} ${xm + 110} ${y0} L1330 ${y0 - 14} L1330 ${y1 + 14} L${xm + 110} ${y1} Q${xm} ${y1 - 18} ${xm - 110} ${y1} L744 ${y1} Z`;
    c.air = el('path', { d: c.bore, 'data-comp': 'venturi', class: 'L-gas' }, gg);
    c.flow = [0, 1, 2].map((k) => el('path', { d: `M1330 ${y0 + 20 + k * 25} C${xm + 120} ${y0 + 22 + k * 23} ${xm - 120} ${y0 + 24 + k * 21} 744 ${y0 + 20 + k * 25}`, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 12', 'stroke-opacity': 0.7, 'pointer-events': 'none', class: 'L-flow' }, gg));
    // câmara da gaveta (em cima)
    el('rect', { x: xm - 44, y: 92, width: 88, height: y0 - 92 + 4, rx: 8, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2 }, gg);
    const sl = el('g', { 'data-comp': 'slide' }, gg);
    c.slide = el('g', {}, sl);
    el('rect', { x: xm - 32, y: 0, width: 64, height: 104, rx: 6, fill: '#c3cad4', stroke: '#2b3542', 'stroke-width': 1 }, c.slide);
    el('path', { d: `M${xm - 4} 104 L${xm + 4} 104 L${xm + 1.5} 182 L${xm - 1.5} 182 Z`, fill: '#e6edf3', stroke: '#2b3542', 'stroke-width': 0.8, 'data-comp': 'needle' }, c.slide);
    el('path', { d: `M${xm - 18} 12 v-10 M${xm + 18} 12 v-10`, stroke: '#8a98a8', 'stroke-width': 2 }, c.slide);
    // giclê e tubo até a cuba
    const jet = el('g', { 'data-comp': 'jet' }, gg);
    el('rect', { x: xm - 7, y: y1 - 22, width: 14, height: 128, fill: '#1b2430', stroke: '#9aa7b6', 'stroke-width': 1 }, jet);
    c.jetFuel = el('rect', { x: xm - 4, width: 8, fill: '#e8a33a' }, jet);
    // cuba e boia
    const bowl = el('g', { 'data-comp': 'bowl' }, gg);
    el('rect', { x: xm - 110, y: y1 + 70, width: 220, height: 140, rx: 16, fill: '#1b2430', stroke: '#9aa7b6', 'stroke-width': 1.2 }, bowl);
    c.fuel = el('rect', { x: xm - 106, width: 212, rx: 12, fill: '#e8a33a', 'fill-opacity': 0.7 }, bowl);
    c.float = el('rect', { x: xm + 30, width: 64, height: 26, rx: 12, fill: '#7f9cc6', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'float' }, bowl);
    // afogador (borboleta na entrada)
    const ch = el('g', { 'data-comp': 'choke' }, gg);
    c.chokeX = 1268; c.chokeY = (y0 + y1) / 2;
    c.choke = el('line', { x1: c.chokeX, y1: c.chokeY - 50, x2: c.chokeX, y2: c.chokeY + 50, stroke: '#f2b632', 'stroke-width': 4, 'stroke-linecap': 'round' }, ch);
    el('circle', { cx: c.chokeX, cy: c.chokeY, r: 4, fill: '#f2b632' }, ch);
    // névoa de gasolina saindo do giclê
    c.mist = el('g', { 'pointer-events': 'none' }, gg);
    c.drops = Array.from({ length: 22 }, () => ({ e: el('circle', { r: 0, fill: '#ffd38a' }, c.mist), age: 9, life: 1 }));
    // nomes e valores
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, gg);
    const lab = (x, y, t, a = 'start') => txt(L, x, y, t, { 'font-size': 13, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    lab(xm + 54, 112, 'Gaveta (pistonete)');
    lab(xm + 54, 172, 'Agulha');
    lab(xm + 20, y1 + 50, 'Giclê');
    lab(xm - 104, y1 + 230, 'Cuba com boia: guarda a gasolina num nível fixo');
    lab(1330, y0 - 44, 'Afogador', 'end');
    lab(752, y0 - 44, '← para o cilindro');
    lab(1330, y1 + 52, 'ar vindo do filtro ←', 'end');
    c.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, gg);
    const vt = (x, y) => txt(c.vals, x, y, '', { 'font-size': 14, fill: '#fff', 'font-family': 'var(--mono)', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    c.v1 = vt(1140, 372); c.v2 = vt(1140, 396); c.v3 = vt(1140, 420); c.v4 = vt(1140, 444);
  }

  // ---------------------------------------------------------------- escapamento
  buildExhaust(g) {
    const e = this.e = {};
    const gg = el('g', { 'data-comp': 'exhaustSys' }, g);
    txt(gg, 990, 558, 'Escapamento', { 'font-size': 15, 'font-weight': 700, fill: '#e6edf3' });
    e.name = txt(gg, 990, 576, '', { 'font-size': 12, fill: '#8da0b6' });
    e.path = 'M1030 604 C1030 690 1060 742 1120 742 L1230 742';
    el('path', { d: e.path, fill: 'none', 'stroke-width': 14, 'stroke-linecap': 'round', stroke: '#5b6d82' }, gg);
    e.core = el('path', { d: e.path, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', class: 'L-gas' }, gg);
    e.meas = el('path', { d: e.path, fill: 'none', stroke: 'none' }, gg);
    e.muf = el('g', { 'data-comp': 'muffler' }, gg);
    e.pulse = el('circle', { r: 0, fill: '#fff2c4', filter: 'url(#glow)', 'pointer-events': 'none' }, gg);
    e.plume = new ExhaustPlume(gg, 60);
    e.kind = null;
  }

  // ======================================================================
  update(st, P, dt) {
    const m = this.m, o = m.cyl;
    this.scene.vib.apply(this.sh, C.x, C.y);
    const th = ((st.vis.theta % 720) + 720) % 720;
    const running = st.running && !st.broken;
    const comb = running && st.comb > 0 && !st.cut.any && !P.failSpark ? 1 : 0;
    const vr = st.vis.rpm;
    m.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `animação em câmera lenta · 1:${Math.round(st.rpm / Math.max(1, vr))}`;

    // virabrequim, pistão, biela
    const psi = th % 360, a = psi * D2R;
    const phiW = A + psi;
    m.fly.setAttribute('transform', `rotate(${phiW.toFixed(1)} ${C.x} ${C.y})`);
    const pin = { x: C.x + G.R * Math.sin(phiW * D2R), y: C.y - G.R * Math.cos(phiW * D2R) };
    attr(m.pin, { cx: pin.x.toFixed(1), cy: pin.y.toFixed(1) });
    const vpp = G.R * Math.cos(a) + Math.sqrt(G.L * G.L - (G.R * Math.sin(a)) ** 2);
    const crown = vpp + G.ch;
    o.piston.setAttribute('transform', `translate(0 ${ly(crown).toFixed(1)})`);
    const pp = W(0, vpp);
    const dx = pp.x - pin.x, dy = pp.y - pin.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    m.rod.setAttribute('d', `M${pp.x + nx * 7} ${pp.y + ny * 7} L${pin.x + nx * 11} ${pin.y + ny * 11} L${pin.x - nx * 11} ${pin.y - ny * 11} L${pp.x - nx * 7} ${pp.y - ny * 7} Z`);
    m.cam.setAttribute('transform', `rotate(${(th / 2).toFixed(1)} ${m.camC.x} ${m.camC.y})`);
    // câmbio: gira com a roda quando engatado
    if (st.gear) this.gearA = ((this.gearA || 0) + st.v * dt * 40) % 360;
    m.g1.gg.setAttribute('transform', `rotate(${(this.gearA || 0).toFixed(1)} ${m.g1.cx} ${m.g1.cy})`);
    m.g2.gg.setAttribute('transform', `rotate(${(-(this.gearA || 0) * 1.25).toFixed(1)} ${m.g2.cx} ${m.g2.cy})`);

    // gás, válvulas, balancins, varetas
    const p = cylPressure(th, { pr: st.pr, adv: st.adv, cr: P.cr, lambda: st.lambda, E, comb });
    o.gas.setAttribute('d', `M${lx(-G.hb)} ${ly(crown - 3)} V${ly(G.deck)} Q${lx(0)} ${ly(G.dome + 16)} ${lx(G.hb)} ${ly(G.deck)} V${ly(crown - 3)} Z`);
    o.gas.setAttribute('fill', gasColor(p));
    o.pv.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
    const li = intakeLift(th, 1, E) * 6.5 * S * 1.4, le = exhaustLift(th, E) * 6.5 * S * 1.4;
    o.vIn.g.setAttribute('transform', `translate(0 ${li.toFixed(1)})`);
    o.vEx.g.setAttribute('transform', `translate(0 ${le.toFixed(1)})`);
    const rock = (el2, piv, pushU, valveU, pivU, pivV, l) => {
      const pushY = ly(G.headTop + 8) - l * 0.55, valveY = ly(G.dome + 92) + l;
      el2.setAttribute('d', `M${lx(pushU)} ${pushY.toFixed(1)} L${lx(pivU)} ${ly(pivV)} L${lx(valveU)} ${valveY.toFixed(1)}`);
      attr(piv, { cx: lx(pivU), cy: ly(pivV) });
    };
    rock(o.rockIn, o.piv[0], G.hb + 34, 24, G.hb + 4, G.headTop + 22, li);
    rock(o.rockEx, o.piv[1], G.hb + 46, -24, 6, G.headTop + 28, le);
    const rodLine = (ln, lf, u, l) => {
      attr(ln, { x1: lx(u), y1: (ly(G.headTop + 8) - l * 0.55).toFixed(1), x2: lx(u), y2: (ly(160) - l * 0.55).toFixed(1) });
      attr(lf, { x: lx(u) - 7, y: (ly(160) - l * 0.55).toFixed(1) });
    };
    rodLine(o.rods[0], o.lift[0], G.hb + 34, li);
    rodLine(o.rods[1], o.lift[1], G.hb + 46, le);
    const ds = th - (360 - st.adv);
    o.spark.setAttribute('r', running && comb && ds >= 0 && ds < 16 ? 8 : 0);
    const xb = comb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
    const fa = comb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 430) / 90)) : 0;
    attr(o.flame, { rx: (fa * 54).toFixed(1), ry: (fa * Math.max(10, (G.dome - crown) * 0.6)).toFixed(1), cy: ly(G.dome - 12 - fa * 8).toFixed(1), 'fill-opacity': fa.toFixed(2) });
    const sk = strokeOf(th);
    attr(o.chipR, { fill: STROKE_COL[sk] });
    o.chip.textContent = STROKES[sk];

    // admissão e escape
    m.inGas.setAttribute('stroke', gasColor(st.pr * 1.013));
    m.exGas.setAttribute('stroke', tempColor(st.temp.egt, 20, 1000));
    const spd = Math.min(400, vr * 0.5 + 20);
    this.flowIn -= (intakeLift(th, 1, E) > 0.05 ? 1 : 0.1) * spd * dt;
    this.flowEx -= (exhaustLift(th, E) > 0.05 ? 1 : 0.1) * spd * dt;
    m.inFlow.setAttribute('stroke-dashoffset', (-this.flowIn % 14).toFixed(1));
    m.exFlow.setAttribute('stroke-dashoffset', (this.flowEx % 14).toFixed(1));
    m.inFlow.style.opacity = m.exFlow.style.opacity = st.rpm > 30 ? 1 : 0;
    const slideH = 12 + 30 * st.tps;
    attr(m.slideMini, { y: (m.carb.y - 44).toFixed(1), height: (44 - slideH + 30).toFixed(1) });
    m.filter.setAttribute('stroke', P.failFilter ? '#7a5a2a' : '#c9b26a');
    m.filter.setAttribute('fill', P.failFilter ? '#4a3a20' : 'none');
    this.oilPh += dt * (1 + st.rpm / 2000);
    const oy = C.y + 104;
    let od = `M${C.x - 70} ${oy}`;
    for (let x = C.x - 70; x <= C.x + 150; x += 10) od += ` L${x} ${oy + Math.sin(x * 0.09 + this.oilPh * 3) * (1 + st.rpm / 4000)}`;
    m.oil.setAttribute('d', `${od} L${C.x + 150} ${C.y + 120} H${C.x - 70} Z`);
    m.vEgt.textContent = `${Math.round(st.temp.egt)} °C`;
    // pedal: desce no chute e volta
    const kt = st.kickT > 0 ? 1 - st.kickT / 0.45 : 1;
    const ka = st.kickT > 0 ? (kt < 0.35 ? kt / 0.35 : 1 - (kt - 0.35) / 0.65) * 70 : 0;
    m.kick.setAttribute('transform', `rotate(${ka.toFixed(1)} ${m.kickPiv.x} ${m.kickPiv.y})`);

    this.updateCarb(st, P, dt, th, running);
    this.updateExhaust(st, P, dt, th, running, comb);
  }

  updateCarb(st, P, dt, th, running) {
    const c = this.c;
    // gaveta: sobe com o acelerador (a CG não tem acelerador eletrônico: a manopla puxa a gaveta)
    const open = st.tps;
    const slideBottom = c.y1 - 14 - (c.y1 - c.y0 - 18) * open;
    c.slide.setAttribute('transform', `translate(0 ${(slideBottom - 104).toFixed(1)})`);
    // depressão no venturi: cresce com a vazão de ar
    const flowAir = st.rpm > 30 ? Math.min(1, st.rpm / E.limit) * (0.25 + 0.75 * Math.max(st.pr, 0.2)) * (0.3 + 0.7 * open) : 0;
    const choke = st.choke;
    const venturi = 1 - 0.18 * flowAir * (choke ? 1.6 : 1);
    c.air.setAttribute('fill', gasColor(st.pr * 1.013 * venturi));
    this.airPh -= (40 + 600 * flowAir) * dt;
    c.flow.forEach((f) => { f.setAttribute('stroke-dashoffset', (this.airPh % 15).toFixed(1)); f.style.opacity = flowAir > 0.01 ? 0.8 : 0; });
    // gasolina: nível na cuba, subindo pelo giclê
    const lvl = c.y1 + 150 - 12 * Math.min(1, flowAir);
    attr(c.fuel, { y: lvl.toFixed(1), height: (c.y1 + 206 - lvl).toFixed(1) });
    attr(c.float, { y: (lvl - 18).toFixed(1) });
    const up = flowAir > 0.01 ? Math.min(1, 0.3 + flowAir) : 0;
    attr(c.jetFuel, { y: (c.y1 + 104 - 120 * up).toFixed(1), height: (120 * up).toFixed(1) });
    // névoa
    const rate = running ? 10 + 90 * flowAir * (choke ? 1.5 : 1) : 0;
    this.mistAcc = (this.mistAcc || 0) + rate * dt;
    while (this.mistAcc >= 1) {
      this.mistAcc -= 1;
      const q = c.drops.find((d) => d.age >= d.life);
      if (!q) break;
      q.age = 0; q.life = 0.4 + 0.4 * Math.random();
      q.x = c.xm + (Math.random() - 0.5) * 8; q.y = c.y1 - 26;
      q.vx = -(120 + 500 * flowAir) * (0.7 + 0.6 * Math.random()); q.vy = -(30 + 60 * Math.random());
    }
    for (const q of c.drops) {
      if (q.age >= q.life) { q.e.setAttribute('r', 0); continue; }
      q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= Math.exp(-4 * dt);
      const u = q.age / q.life;
      if (q.x < 750) { q.age = 9; q.e.setAttribute('r', 0); continue; }
      attr(q.e, { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (1.5 + 2.5 * u).toFixed(1), 'fill-opacity': (0.8 * (1 - u)).toFixed(2) });
    }
    c.choke.setAttribute('transform', `rotate(${choke ? 0 : 90} ${c.chokeX} ${c.chokeY})`);
    c.v1.textContent = `Gaveta ${Math.round(open * 100)}%`;
    c.v2.textContent = `Afogador ${choke ? 'LIGADO' : 'desligado'}`;
    c.v3.textContent = `Venturi −${fmt(18 * flowAir * (choke ? 1.6 : 1), 1)} kPa`;
    c.v4.textContent = running ? `λ ${fmt(st.lambda, 2)}${st.lambda < 0.85 ? ' rica' : st.lambda > 1.05 ? ' pobre' : ''}` : 'λ —';
    c.v2.setAttribute('fill', choke ? '#f2b632' : '#fff');
  }

  updateExhaust(st, P, dt, th, running, comb) {
    const e = this.e;
    if (e.kind !== mufKey(P)) { e.kind = mufKey(P); e.tail = drawMuffler(e.muf, P, 1225, 742, false).tail; }
    e.name.textContent = P.muffler === false ? 'sem silencioso' : P.baffle > 0.75 ? 'escapamento original' : P.baffle > 0.3 ? 'ponteira esportiva' : 'ponteira aberta';
    e.core.setAttribute('stroke', tempColor(st.temp.egt, 20, 1000));
    let u = (th - E.valve.exh.evo) / 240;
    if (th < E.valve.exh.evo) u = (th + 720 - E.valve.exh.evo) / 240;
    if (u >= 0 && u <= 1 && st.rpm > 30) {
      const Lm = e.meas.getTotalLength(), pt = e.meas.getPointAtLength(u * Lm);
      attr(e.pulse, { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: (comb ? 7 + 3 * st.pr : 4) * (1 - 0.4 * u), 'fill-opacity': comb ? 0.95 : 0.4 });
    } else e.pulse.setAttribute('r', 0);
    e.plume.setTails([{ x: e.tail, y: 742 }]);
    e.plume.update(st, P, dt);
  }
}
