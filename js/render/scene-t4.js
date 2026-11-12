// Desenho do 4 cilindros turbo de carro (SVG), usado pelo Scene quando o motor é o 't4'.
// Região da esquerda (702 × 784): vista frontal em corte dos 4 cilindros e, à direita deles, o turbo:
// a turbina (lado quente, movida pelo gás de escape), o compressor (lado frio) no mesmo eixo, o intercooler,
// a wastegate e a válvula de alívio. O arrefecimento e o escapamento são desenhados por scene-car.js.
import { el, txt, attr, gasColor, tempColor, fmt, fmtInt } from './svg.js';
import { ENGINES } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, strokeOf, localAngle } from '../sim/engine.js';
import { CarExhaust, STROKES, STROKE_COL } from './scene-car.js';
import { wrapShake } from './shake.js';

const E = ENGINES.t4;
const D2R = Math.PI / 180;
const S = 1.12;
const F = { x: [118, 226, 334, 442], yc: 566 };
F.R = (E.stroke / 2) * S; F.L = E.rod * S; F.ch = E.ch * S; F.bh = 50; F.hb = (E.bore / 2) * S;
F.crownTdc = F.yc - F.R - F.L - F.ch;
F.deck = F.crownTdc - 2;
F.roof = F.deck - 14;
F.camIn = F.deck - 118; F.camEx = F.deck - 106;
F.top = F.deck - 150;
const X0 = F.x[0] - 62, X1 = F.x[3] + 62;
const TB = { x: 604, yT: 250, yC: 400, r: 44 };   // turbina em cima, compressor embaixo

function slider(deg, R, L) {
  const a = deg * D2R, sx = R * Math.sin(a);
  return { py: -R * Math.cos(a), pin: -(R * Math.cos(a) + Math.sqrt(L * L - sx * sx)) };
}

export class T4View {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.oilPh = 0; this.tA = 0; this.flowP = 0; this.flowX = 0;
    const ge = el('g', {}, g);
    this.build(ge);
    this.sh = wrapShake(ge);
    this.ex = new CarExhaust(g, E, { title: 'Escape: 4 em 1, turbina e silencioso', turbo: true });
  }

  build(g) {
    const f = this.f = { cyl: [] };
    txt(g, 24, 40, 'Os 4 cilindros e o turbo', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    f.order = txt(g, 24, 64, `Ordem de ignição ${E.order.inline} · uma explosão a cada meia volta`, { 'font-size': 14, fill: '#8da0b6' });
    f.slow = txt(g, 680, 40, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    this.buildTurbo(g);

    // cabeçote, bloco, cárter
    const head = el('g', { 'data-comp': 'head' }, g);
    el('path', { d: `M${X0} ${F.deck} V${F.top + 18} q0 -18 18 -18 H${X1 - 18} q18 0 18 18 V${F.deck} Z`, fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2 }, head);
    el('rect', { x: X0 + 6, y: F.top - 10, width: X1 - X0 - 12, height: 14, rx: 6, fill: '#323f4f', stroke: '#5b6d82', 'stroke-width': 1 }, head);
    const block = el('g', { 'data-comp': 'block' }, g);
    el('path', { d: `M${X0} ${F.deck} H${X1} V${F.yc - 40} H${X0} Z`, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2 }, block);
    f.water = [];
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? X0 + 4 : i === 4 ? X1 - 12 : (F.x[i - 1] + F.x[i]) / 2 - 4;
      f.water.push(el('rect', { x, y: F.deck + 6, width: 8, height: 150, rx: 3, 'data-comp': 'coolant', class: 'L-gas' }, block));
    }
    const cc = el('g', { 'data-comp': 'crankcase' }, g);
    el('path', { d: `M${X0} ${F.yc - 40} H${X1} V${F.yc + 56} Q${X1} ${F.yc + 76} ${X1 - 30} ${F.yc + 80} H${X0 + 30} Q${X0} ${F.yc + 76} ${X0} ${F.yc + 56} Z`, fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, cc);
    const sump = el('g', { 'data-comp': 'oil' }, g);
    el('path', { d: `M${X0 + 40} ${F.yc + 80} H${X1 - 40} V${F.yc + 108} q0 10 -10 10 H${X0 + 50} q-10 0 -10 -10 Z`, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, sump);
    f.oil = el('path', { fill: '#b5832a', 'fill-opacity': 0.75 }, sump);

    // comandos (admissão atrás, mais claro) e virabrequim
    el('rect', { x: X0 + 10, y: F.camIn - 5, width: X1 - X0 - 20, height: 10, rx: 5, fill: '#5b7aa6', 'fill-opacity': 0.55, 'data-comp': 'camIn' }, g);
    el('rect', { x: X0 + 10, y: F.camEx - 5, width: X1 - X0 - 20, height: 10, rx: 5, fill: '#a6795b', 'fill-opacity': 0.8, 'data-comp': 'camEx' }, g);
    const crank = el('g', { 'data-comp': 'crank' }, g);
    el('rect', { x: X0 - 14, y: F.yc - 9, width: X1 - X0 + 20, height: 18, rx: 6, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, crank);
    // polia do virabrequim (gira a bomba d'água e o compressor do ar-condicionado)
    f.pulley = el('g', {}, crank);
    el('rect', { x: X0 - 26, y: F.yc - 30, width: 16, height: 60, rx: 4, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1 }, f.pulley);
    f.pmark = el('rect', { x: X0 - 26, width: 16, height: 5, fill: '#f2b632' }, f.pulley);
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? F.x[0] - 54 : i === 4 ? F.x[3] + 54 : (F.x[i - 1] + F.x[i]) / 2;
      el('rect', { x: x - 8, y: F.yc - 15, width: 16, height: 30, rx: 3, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'bearing' }, g);
    }
    for (let i = 0; i < 4; i++) f.cyl.push(this.buildCyl(g, i));

    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, s, px, py, a = 'middle') => {
      el('path', { d: `M${x} ${y - 14} L${px} ${py}`, stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6, fill: 'none' }, L);
      el('circle', { cx: px, cy: py, r: 2, fill: '#8da0b6' }, L);
      txt(L, x, y, s, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    };
    lab(90, 722, 'Virabrequim', (F.x[0] + F.x[1]) / 2, F.yc + 16);
    lab(280, 722, 'Óleo', 280, F.yc + 104);
    lab(442, 722, 'Biela', F.x[3], F.yc - 90);
  }

  buildCyl(g, i) {
    const x = F.x[i], hb = F.hb, o = {};
    const cg = el('g', { 'data-cyl': i, class: 'cylg' }, g);
    el('rect', { x: x - hb - 4, y: F.roof, width: 2 * hb + 8, height: F.yc - 40 - F.roof, fill: '#151d27', 'data-comp': 'cylinder' }, cg);
    o.gas = el('rect', { x: x - hb, y: F.roof, width: 2 * hb, height: 20, 'data-comp': 'chamber', class: 'L-gas' }, cg);
    o.flame = el('ellipse', { cx: x, cy: F.roof + 6, rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, cg);
    for (const sd of [-1, 1]) el('line', { x1: x + sd * hb, y1: F.roof, x2: x + sd * hb, y2: F.yc - 40, stroke: '#7e8ea0', 'stroke-width': 1.2 }, cg);
    const vx = 20;
    o.vIn = [-1, 1].map((sd) => {
      const v = el('g', { 'data-comp': 'valveIn' }, cg);
      el('path', { d: `M${x + sd * vx - 14} ${F.roof + 1} L${x + sd * vx + 14} ${F.roof + 1} L${x + sd * vx + 3} ${F.roof - 6} V${F.deck - 100} H${x + sd * vx - 3} V${F.roof - 6} Z`, fill: '#7f9cc6', 'fill-opacity': 0.5, stroke: '#a8c3ea', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }, v);
      return v;
    });
    o.vEx = [-1, 1].map((sd) => {
      const v = el('g', { 'data-comp': 'valveEx' }, cg);
      el('path', { d: `M${x + sd * vx - 13} ${F.roof} L${x + sd * vx + 13} ${F.roof} L${x + sd * vx + 3} ${F.roof - 7} V${F.deck - 88} H${x + sd * vx - 3} V${F.roof - 7} Z`, fill: '#c9b2a0', stroke: '#2b3542', 'stroke-width': 0.8 }, v);
      el('path', { d: Array.from({ length: 6 }, (_, k) => `M${x + sd * vx - 8} ${F.deck - 88 + k * 4.2} l16 2.1`).join(' '), stroke: '#8fa0b2', 'stroke-width': 1.2, fill: 'none' }, v);
      el('rect', { x: x + sd * vx - 9, y: F.deck - 99, width: 18, height: 11, rx: 2, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 0.8 }, v);
      return v;
    });
    o.lobeIn = [-1, 1].map((sd) => el('rect', { x: x + sd * vx - 7, width: 14, rx: 6, fill: '#7f9cc6', 'fill-opacity': 0.75, 'data-comp': 'camIn' }, cg));
    o.lobeEx = [-1, 1].map((sd) => el('rect', { x: x + sd * vx - 7, width: 14, rx: 6, fill: '#c08a62', 'data-comp': 'camEx' }, cg));
    const sp = el('g', { 'data-comp': 'spark' }, cg);
    el('rect', { x: x - 3.5, y: F.top + 4, width: 7, height: F.roof - F.top - 6, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8 }, sp);
    el('rect', { x: x - 11, y: F.top - 14, width: 22, height: 22, rx: 4, fill: '#20262e', stroke: '#5b6d82', 'stroke-width': 1 }, sp);
    o.spark = el('circle', { cx: x, cy: F.roof + 2, r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, cg);
    // injeção direta: o bico pulveriza dentro do cilindro
    o.spray = el('path', { d: `M${x + hb} ${F.roof + 6} L${x - 8} ${F.roof + 44} L${x + 14} ${F.roof + 58} Z`, fill: '#dff3ff', 'fill-opacity': 0, 'pointer-events': 'none', 'data-comp': 'injector' }, cg);
    el('rect', { x: x + hb - 2, y: F.roof - 2, width: 10, height: 12, rx: 2, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 0.8, 'data-comp': 'injector' }, cg);

    o.cw = el('rect', { x: x - 34, width: 68, rx: 10, fill: '#4a5768', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'crank' }, cg);
    o.webs = [-1, 1].map((sd) => el('rect', { x: x + sd * 24 - 7, width: 14, rx: 6, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'crank' }, cg));
    o.rod = el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.bigEnd = el('rect', { x: x - 16, width: 32, height: 26, rx: 8, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.piston = el('g', { 'data-comp': 'piston' }, cg);
    el('rect', { x: x - hb + 1, y: 0, width: 2 * hb - 2, height: F.bh, rx: 3, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    for (const yy of [6, 11, 16]) el('line', { x1: x - hb + 1, y1: yy, x2: x + hb - 1, y2: yy, stroke: '#4f5b69', 'stroke-width': 1 }, o.piston);
    el('circle', { cx: x, cy: F.ch, r: 8, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);

    o.num = txt(g, x, F.top - 52, `${i + 1}`, { 'font-size': 26, 'font-weight': 800, fill: '#e6edf3', 'text-anchor': 'middle', 'data-cyl': i, style: 'cursor:pointer' });
    o.chipR = el('rect', { x: x - 52, y: F.top - 43, width: 104, height: 24, rx: 12, 'data-cyl': i, style: 'cursor:pointer' }, g);
    o.chip = txt(g, x, F.top - 27, '', { 'font-size': 11, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' });
    o.selR = el('rect', { x: x - 53, y: F.top - 78, width: 106, height: F.yc + 122 - F.top + 78, rx: 12, fill: 'none', stroke: '#4fa3ff', 'stroke-width': 1.5, 'stroke-dasharray': '5 5', 'pointer-events': 'none' }, g);
    o.pv = txt(g, x, F.roof + 34, '', { 'font-size': 12, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'var(--mono)', class: 'L-values', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    return o;
  }

  // ---------------------------------------------------------------- turbo
  buildTurbo(g) {
    const t = this.t = {};
    const { x, yT, yC, r } = TB;
    const pipe = (d, w, comp) => {
      const gg = el('g', { 'data-comp': comp }, g);
      el('path', { d, fill: 'none', stroke: '#5b6d82', 'stroke-width': w + 6, 'stroke-linejoin': 'round' }, gg);
      const gas = el('path', { d, fill: 'none', 'stroke-width': w, 'stroke-linejoin': 'round', class: 'L-gas' }, gg);
      const flow = el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, gg);
      return { gas, flow };
    };
    t.man = pipe(`M${X1 - 4} ${yT} H${x - r + 6}`, 18, 'header');
    t.out = pipe(`M${x + r - 6} ${yT} H688 V612`, 16, 'header');
    t.wg = pipe(`M${x - 62} ${yT - 8} C${x - 62} ${yT - 78} ${x + 70} ${yT - 78} 688 ${yT - 4}`, 7, 'wastegate');
    t.inl = pipe(`M${x} 524 V${yC + r - 6}`, 18, 'airbox');
    t.chg = pipe(`M${x - r + 6} ${yC} H530 V300 H${X1 - 4}`, 16, 'intake');
    // intercooler: resfria o ar que o compressor esquentou
    const ic = el('g', { 'data-comp': 'intercooler' }, g);
    el('rect', { x: 514, y: 318, width: 32, height: 66, rx: 5, fill: '#2a3644', 'fill-opacity': 0.8, stroke: '#c3cad4', 'stroke-width': 1.2 }, ic);
    el('path', { d: Array.from({ length: 7 }, (_, k) => `M516 ${326 + k * 8.5} H544`).join(' '), stroke: '#c3cad4', 'stroke-width': 1.4 }, ic);
    // filtro de ar
    const af = el('g', { 'data-comp': 'airbox' }, g);
    el('rect', { x: x - 44, y: 520, width: 88, height: 46, rx: 10, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, af);
    t.filter = el('rect', { x: x - 36, y: 528, width: 72, height: 30, rx: 5, fill: 'none', stroke: '#c9b26a', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'data-comp': 'filter' }, af);
    // eixo e mancal central
    const sh = el('g', { 'data-comp': 'turboShaft' }, g);
    el('rect', { x: x - 4, y: yT + r - 4, width: 8, height: yC - yT - 2 * r + 8, fill: '#c3cad4' }, sh);
    el('rect', { x: x - 17, y: yT + r + 8, width: 34, height: yC - yT - 2 * r - 16, rx: 6, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1.2 }, sh);
    t.oilDot = el('circle', { cx: x, cy: (yT + yC) / 2, r: 5, fill: '#b5832a' }, sh);
    // rodas
    const wheel = (cy, comp, col) => {
      const gg = el('g', { 'data-comp': comp }, g);
      const ring = el('circle', { cx: x, cy, r: r + 2, fill: '#151d27', 'stroke-width': 9, class: 'L-gas' }, gg);
      el('circle', { cx: x, cy, r: r + 7, fill: 'none', stroke: '#8a98a8', 'stroke-width': 1.5 }, gg);
      const rot = el('g', {}, gg);
      for (let k = 0; k < 9; k++) el('path', { d: `M${x + 9} ${cy} Q${x + r * 0.55} ${cy - r * 0.42} ${x + r - 6} ${cy - 4}`, fill: 'none', stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round', transform: `rotate(${k * 40} ${x} ${cy})` }, rot);
      el('circle', { cx: x, cy, r: 10, fill: '#5d6b7c', stroke: '#c3cad4', 'stroke-width': 1 }, rot);
      el('line', { x1: x, y1: cy, x2: x, y2: cy - 9, stroke: '#f2b632', 'stroke-width': 2 }, rot);
      return { ring, rot, cy };
    };
    t.turb = wheel(yT, 'turbine', '#e0a070');
    t.comp = wheel(yC, 'compressor', '#9db6d8');
    // wastegate (portinhola no desvio) e válvula de alívio
    const wg = el('g', { 'data-comp': 'wastegate' }, g);
    t.wgFlap = el('line', { x1: x + 4, y1: yT - 76, x2: x + 4, y2: yT - 54, stroke: '#f2b632', 'stroke-width': 4, 'stroke-linecap': 'round' }, wg);
    el('circle', { cx: x + 4, cy: yT - 65, r: 3, fill: '#f2b632' }, wg);
    const bov = el('g', { 'data-comp': 'bov' }, g);
    el('rect', { x: 536, y: yC - 28, width: 16, height: 18, rx: 4, fill: '#3a4859', stroke: '#f2b632', 'stroke-width': 1.2 }, bov);
    t.puff = el('g', { 'pointer-events': 'none' }, g);
    t.puffs = [0, 1, 2].map(() => el('circle', { cx: 544, cy: yC - 34, r: 0, fill: '#eef3f8' }, t.puff));

    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (lx, ly, s, a = 'end') => txt(L, lx, ly, s, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    lab(x + 4, yT - 88, 'Wastegate', 'middle');
    lab(672, yT + r + 22, 'Turbina');
    lab(672, yC + r + 24, 'Compressor');
    lab(x, 584, 'Filtro de ar', 'middle');
    t.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    const vt = (lx, ly, fs = 14) => txt(t.vals, lx, ly, '', { 'font-size': fs, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    t.vB = vt(x, 612, 16);
    t.vN = vt(x, 634, 12.5);
  }

  resetFx() { this.ex.plume.reset(); }

  // ======================================================================
  update(st, P, dt) {
    const f = this.f, vib = this.scene.vib;
    vib.apply(this.sh, (F.x[1] + F.x[2]) / 2, F.yc, 1, 1);
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const pOpt = { pr: st.map, adv: st.adv, cr: P.cr, lambda: st.lambda, E };
    const vr = st.vis.rpm;
    f.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `animação em câmera lenta · 1:${Math.round(st.rpm / Math.max(1, vr))}`;
    const wcol = tempColor(st.temp.coolant, 20, 125);
    f.water.forEach((w) => w.setAttribute('fill', wcol));
    this.oilPh += dt * (1 + st.rpm / 2000);
    const oy = F.yc + 98, xa = X0 + 40, xb = X1 - 40;
    let od = `M${xa} ${oy}`;
    for (let x = xa; x <= xb; x += 12) od += ` L${x} ${oy + Math.sin(x * 0.08 + this.oilPh * 3) * (1 + st.rpm / 5000)}`;
    f.oil.setAttribute('d', `${od} V${F.yc + 118} H${xa} Z`);
    const th0 = localAngle(st, P, E, 0);
    attr(f.pmark, { y: (F.yc - 2.5 - 26 * Math.cos(th0 * D2R)).toFixed(1), opacity: Math.sin(th0 * D2R) > -0.2 ? 1 : 0.15 });

    for (let i = 0; i < 4; i++) {
      const o = f.cyl[i], th = localAngle(st, P, E, i), x = F.x[i];
      const k = slider(th % 360, F.R, F.L);
      const pinY = F.yc + k.py, ppY = F.yc + k.pin, crown = ppY - F.ch;
      o.piston.setAttribute('transform', `translate(0 ${crown.toFixed(1)})`);
      const cwY = F.yc - k.py * 1.15;
      attr(o.cw, { y: (Math.min(F.yc, cwY) - 12).toFixed(1), height: (Math.abs(cwY - F.yc) + 24).toFixed(1) });
      const y0 = Math.min(pinY, cwY), y1 = Math.max(pinY, cwY);
      o.webs.forEach((w) => attr(w, { y: (y0 - 8).toFixed(1), height: (y1 - y0 + 16).toFixed(1) }));
      attr(o.bigEnd, { y: (pinY - 13).toFixed(1) });
      o.rod.setAttribute('d', `M${x - 7} ${ppY} L${x + 7} ${ppY} L${x + 11} ${pinY} L${x - 11} ${pinY} Z`);
      const cmb = combOn && (i + 1) !== P.failSpark ? 1 : 0;
      const p = cylPressure(th, { ...pOpt, comb: cmb });
      attr(o.gas, { height: Math.max(1, crown - F.roof + 3).toFixed(1), fill: gasColor(p) });
      o.pv.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
      const li = intakeLift(th, 1, E) * E.valve.full.lift * S * 1.2, le = exhaustLift(th, E) * E.valve.exh.lift * S * 1.2;
      o.vIn.forEach((v) => v.setAttribute('transform', `translate(0 ${li.toFixed(1)})`));
      o.vEx.forEach((v) => v.setAttribute('transform', `translate(0 ${le.toFixed(1)})`));
      o.lobeIn.forEach((l) => attr(l, { y: (F.camIn - 8).toFixed(1), height: (16 + li).toFixed(1) }));
      o.lobeEx.forEach((l) => attr(l, { y: (F.camEx - 8).toFixed(1), height: (16 + le).toFixed(1) }));
      const ds = th - (360 - st.adv);
      o.spark.setAttribute('r', running && cmb && ds >= 0 && ds < 14 ? 7 : 0);
      const xb2 = cmb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
      const fa = cmb && ds > 0 && th < 520 ? Math.min(1, xb2 * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
      attr(o.flame, { rx: (fa * (F.hb - 2)).toFixed(1), ry: (fa * Math.max(8, (crown - F.roof) * 0.7)).toFixed(1), cy: (F.roof + (crown - F.roof) * 0.35).toFixed(1), 'fill-opacity': fa.toFixed(2) });
      o.spray.setAttribute('fill-opacity', running && !st.cut.any && th > 60 && th < 150 ? (0.3 + 0.4 * st.tps).toFixed(2) : 0);
      const sk = strokeOf(th);
      attr(o.chipR, { fill: STROKE_COL[sk] });
      o.chip.textContent = STROKES[sk];
      o.selR.style.display = i === this.scene.cyl ? '' : 'none';
    }

    // ---------- turbo ----------
    const t = this.t, sp = st.spool;
    // desenho em câmera lenta: a turbina de verdade passa de 150.000 rpm
    this.tA = (this.tA + sp * (P.anim === 'real' ? 1500 : 320) * dt) % 360;
    t.turb.rot.setAttribute('transform', `rotate(${this.tA.toFixed(1)} ${TB.x} ${TB.yT})`);
    t.comp.rot.setAttribute('transform', `rotate(${this.tA.toFixed(1)} ${TB.x} ${TB.yC})`);
    const hot = tempColor(st.temp.egt, 20, 1000), cool = tempColor(st.temp.egt * 0.78, 20, 1000);
    const chg = gasColor(1.013 * (1 + st.boost)), amb = gasColor(1.0);
    t.turb.ring.setAttribute('stroke', hot); t.man.gas.setAttribute('stroke', hot); t.out.gas.setAttribute('stroke', cool); t.wg.gas.setAttribute('stroke', cool);
    t.comp.ring.setAttribute('stroke', chg); t.chg.gas.setAttribute('stroke', chg); t.inl.gas.setAttribute('stroke', amb);
    const flow = st.rpm > 30 ? 30 + 260 * Math.min(1, st.rpm / E.limit) * (0.3 + 0.7 * Math.min(1.2, st.map)) : 0;
    this.flowP -= flow * dt;
    const wgOpen = running && st.boost > 0.93 * Math.min(P.boost ?? E.turbo.boost, 9) && st.boost > 0.2 ? 1 : 0;
    this.wgA = (this.wgA || 0) + (wgOpen - (this.wgA || 0)) * (1 - Math.exp(-dt / 0.12));
    for (const q of [t.man, t.out, t.inl, t.chg]) { q.flow.setAttribute('stroke-dashoffset', (this.flowP % 14).toFixed(1)); q.flow.style.opacity = flow > 0 ? 1 : 0; }
    t.wg.flow.setAttribute('stroke-dashoffset', (this.flowP % 14).toFixed(1)); t.wg.flow.style.opacity = this.wgA > 0.3 ? 1 : 0;
    t.wgFlap.setAttribute('transform', `rotate(${(80 * this.wgA).toFixed(1)} ${TB.x + 4} ${TB.yT - 65})`);
    const bt = Math.max(0, st.bovT || 0) / 0.5;
    t.puffs.forEach((c, k) => attr(c, { r: bt > 0 && P.bov !== 'recirc' ? ((1 - bt) * (16 + 9 * k) + 4).toFixed(1) : 0, cy: (TB.yC - 34 - (1 - bt) * (22 + 14 * k)).toFixed(1), cx: 544 + (k - 1) * 9 * (1 - bt), 'fill-opacity': (0.6 * bt).toFixed(2) }));
    t.filter.setAttribute('stroke', P.failFilter ? '#7a5a2a' : '#c9b26a');
    t.filter.setAttribute('fill', P.failFilter ? '#4a3a20' : 'none');
    t.vB.textContent = `turbo ${st.boost >= 0.005 ? '+' : ''}${fmt(Math.max(0, st.boost), 2)} bar`;
    t.vB.setAttribute('fill', st.boost > 1.45 ? '#ff6b6b' : st.boost > 0.2 ? '#f2b632' : '#fff');
    t.vN.textContent = sp > 0.02 ? `${fmtInt(Math.round(sp * 170) * 1000)} rpm` : 'parado';

    this.ex.update(st, P, dt);
  }
}
