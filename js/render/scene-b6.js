// Desenho do boxer de 6 cilindros (SVG), usado pelo Scene quando o motor é o 'b6'.
// Região da esquerda (702 × 784): o motor visto de cima. O virabrequim corre na vertical, no meio; três
// cilindros deitados para cada lado. Os pistões opostos (1-4, 2-5, 3-6) vão e voltam juntos, como dois
// boxeadores trocando socos: é daí que vem o nome, e é por isso que ele quase não vibra.
import { el, txt, attr, gasColor, tempColor, fmt } from './svg.js';
import { ENGINES } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, strokeOf, localAngle } from '../sim/engine.js';
import { CarExhaust, STROKES, STROKE_COL } from './scene-car.js';
import { wrapShake } from './shake.js';

const E = ENGINES.b6;
const D2R = Math.PI / 180;
const S = 0.94;
const C = { x: 351 };
const G = { R: (E.stroke / 2) * S, L: E.rod * S, ch: E.ch * S, bh: 44, hb: (E.bore / 2) * S };
G.crownTdc = G.R + G.L + G.ch;     // distância do eixo até o topo do pistão no PMS
G.deck = G.crownTdc + 2;
G.roof = G.deck + 13;
G.head = G.deck + 78;
G.case = 100;
// cilindro k: lado (−1 esquerda, +1 direita) e posição ao longo do virabrequim
const CY = [0, 1, 2, 3, 4, 5].map((k) => ({ sd: k < 3 ? -1 : 1, y: 244 + (k % 3) * 116 + (k < 3 ? 0 : 32) }));
const Y0 = 190, Y1 = 590;

export class B6View {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    const ge = this.ge = el('g', {}, g);
    this.build(ge);
    this.sh = wrapShake(ge);
    this.ex = new CarExhaust(g, E, { title: 'Escape: 3 em 1 de cada lado', groups: [1030, 1030, 1030, 1104, 1104, 1104] });
  }

  build(g) {
    const m = this.m = { cyl: [] };
    txt(g, 24, 40, 'O boxer visto de cima', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    txt(g, 24, 64, `Ordem de ignição ${E.order.boxer} · uma explosão a cada 120°`, { 'font-size': 14, fill: '#8da0b6' });
    m.slow = txt(g, 680, 40, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    // cárter (no meio) e os dois cabeçotes (nas pontas)
    const cc = el('g', { 'data-comp': 'crankcase' }, g);
    el('rect', { x: C.x - G.case, y: Y0, width: 2 * G.case, height: Y1 - Y0, rx: 16, fill: '#1e2834', stroke: '#5b6d82', 'stroke-width': 1.2 }, cc);
    m.oil = el('rect', { x: C.x - G.case + 8, y: Y1 - 26, width: 2 * G.case - 16, height: 18, rx: 8, fill: '#b5832a', 'fill-opacity': 0.6, 'data-comp': 'oil' }, g);
    for (const sd of [-1, 1]) {
      const xa = C.x + sd * G.case, xb = C.x + sd * G.deck, xc = C.x + sd * G.head;
      const yo = sd < 0 ? 0 : 32;
      el('rect', { x: Math.min(xa, xb), y: Y0 + yo + 2, width: Math.abs(xb - xa), height: 3 * 116 - 4, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'block' }, g);
      el('rect', { x: Math.min(xb, xc), y: Y0 + yo - 4, width: Math.abs(xc - xb), height: 3 * 116 + 8, rx: 10, fill: '#2a3644', stroke: '#5b6d82', 'stroke-width': 1.2, 'data-comp': 'head' }, g);
      // comandos no cabeçote (um de admissão e um de escape por bancada)
      el('rect', { x: C.x + sd * (G.head - 22) - 4, y: Y0 + yo + 6, width: 8, height: 3 * 116 - 12, rx: 4, fill: '#5b7aa6', 'fill-opacity': 0.7, 'data-comp': 'camIn' }, g);
      el('rect', { x: C.x + sd * (G.head - 40) - 4, y: Y0 + yo + 6, width: 8, height: 3 * 116 - 12, rx: 4, fill: '#a6795b', 'fill-opacity': 0.8, 'data-comp': 'camEx' }, g);
    }
    // camisas d'água entre os cilindros
    m.water = [];
    for (const c of CY) for (const dy of [-1, 1]) {
      const xa = C.x + c.sd * (G.case + 4), xb = C.x + c.sd * (G.deck - 4);
      m.water.push(el('rect', { x: Math.min(xa, xb), y: c.y + dy * (G.hb + 7) - 3, width: Math.abs(xb - xa), height: 6, rx: 3, 'data-comp': 'coolant', class: 'L-gas' }, g));
    }
    // virabrequim e mancais
    const crank = el('g', { 'data-comp': 'crank' }, g);
    el('rect', { x: C.x - 8, y: Y0 - 26, width: 16, height: Y1 - Y0 + 40, rx: 6, fill: '#5d6b7c', stroke: '#9aa7b6', 'stroke-width': 1 }, crank);
    m.fly = el('rect', { x: C.x - 46, y: Y0 - 34, width: 92, height: 14, rx: 4, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1 }, crank);
    m.flyMark = el('rect', { y: Y0 - 34, width: 6, height: 14, fill: '#f2b632' }, crank);
    for (const y of [214, 318, 434, 550]) el('rect', { x: C.x - 15, y: y - 7, width: 30, height: 14, rx: 3, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'bearing' }, g);

    for (let k = 0; k < 6; k++) m.cyl.push(this.buildCyl(g, k));

    // legenda dos tempos e nomes
    const lg = el('g', { class: 'noshake' }, g);
    STROKES.forEach((s, k) => {
      el('rect', { x: 60 + k * 152, y: 628, width: 136, height: 26, rx: 13, fill: STROKE_COL[k] }, lg);
      txt(lg, 128 + k * 152, 646, s, { 'font-size': 12.5, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle' });
    });
    txt(lg, 351, 690, 'Os pistões de frente um para o outro vão e voltam juntos: as forças se anulam.', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'middle' });
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, s, a = 'middle') => txt(L, x, y, s, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    lab(C.x, Y0 - 44, 'Volante e virabrequim');
    lab(C.x - G.head + 4, Y0 - 14, 'Cabeçote', 'start');
    lab(C.x + G.head - 4, Y0 + 14, 'Cabeçote', 'end');
    lab(C.x, Y1 + 20, 'Cárter');
  }

  buildCyl(g, k) {
    const c = CY[k], sd = c.sd, hb = G.hb, o = {};
    const X = (d) => C.x + sd * d;                       // distância do eixo → x na tela
    const rx = (d0, d1) => ({ x: Math.min(X(d0), X(d1)), width: Math.abs(d1 - d0) });
    const cg = el('g', { 'data-cyl': k, class: 'cylg' }, g);
    el('rect', { ...rx(G.case, G.roof), y: c.y - hb - 3, height: 2 * hb + 6, fill: '#151d27', 'data-comp': 'cylinder' }, cg);
    o.gas = el('rect', { y: c.y - hb, height: 2 * hb, 'data-comp': 'chamber', class: 'L-gas' }, cg);
    o.flame = el('ellipse', { cy: c.y, rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, cg);
    for (const dy of [-1, 1]) el('line', { x1: X(G.case), y1: c.y + dy * hb, x2: X(G.roof), y2: c.y + dy * hb, stroke: '#7e8ea0', 'stroke-width': 1.2 }, cg);
    // válvulas (admissão em cima no desenho, escape embaixo) e ressaltos
    const valve = (dy, comp, col) => {
      const v = el('g', { 'data-comp': comp }, cg);
      const y = c.y + dy * 21, xr = X(G.roof), xs = X(G.head - 14);
      el('path', { d: `M${xr} ${y - 13} L${xr} ${y + 13} L${xr + sd * 7} ${y + 3} L${xs} ${y + 3} L${xs} ${y - 3} L${xr + sd * 7} ${y - 3} Z`, fill: col, stroke: '#2b3542', 'stroke-width': 0.8 }, v);
      return v;
    };
    o.vIn = valve(-1, 'valveIn', '#9db6d8');
    o.vEx = valve(1, 'valveEx', '#c9b2a0');
    o.lobeIn = el('rect', { y: c.y - 21 - 7, height: 14, rx: 6, fill: '#7f9cc6', 'data-comp': 'camIn' }, cg);
    o.lobeEx = el('rect', { y: c.y + 21 - 7, height: 14, rx: 6, fill: '#c08a62', 'data-comp': 'camEx' }, cg);
    const sp = el('g', { 'data-comp': 'spark' }, cg);
    el('rect', { ...rx(G.roof - 2, G.head + 10), y: c.y - 3, height: 6, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8 }, sp);
    el('rect', { ...rx(G.head + 2, G.head + 22), y: c.y - 9, height: 18, rx: 4, fill: '#20262e', stroke: '#5b6d82', 'stroke-width': 1 }, sp);
    o.spark = el('circle', { cx: X(G.roof - 3), cy: c.y, r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, cg);
    // manivela, biela, pistão
    o.web = el('rect', { y: c.y - 15, height: 30, rx: 5, fill: '#4a5768', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'crank' }, cg);
    o.rod = el('path', { fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.bigEnd = el('rect', { y: c.y - 12, width: 26, height: 24, rx: 7, fill: '#8d99a8', stroke: '#2b3542', 'stroke-width': 1, 'data-comp': 'rod' }, cg);
    o.piston = el('g', { 'data-comp': 'piston' }, cg);
    // pistão desenhado com o topo em x = 0, apontando para fora
    el('rect', { x: sd > 0 ? -G.bh : 0, y: c.y - hb + 1, width: G.bh, height: 2 * hb - 2, rx: 3, fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    for (const d of [6, 11, 16]) el('line', { x1: -sd * d, y1: c.y - hb + 1, x2: -sd * d, y2: c.y + hb - 1, stroke: '#4f5b69', 'stroke-width': 1 }, o.piston);
    el('circle', { cx: -sd * G.ch, cy: c.y, r: 7, fill: '#6f7d8e', stroke: '#2b3542', 'stroke-width': 1 }, o.piston);
    // número do cilindro com a cor do tempo, e a pressão
    o.tag = el('circle', { cx: X(G.head + 42), cy: c.y, r: 13, 'data-cyl': k, style: 'cursor:pointer' }, cg);
    txt(cg, X(G.head + 42), c.y + 5, `${k + 1}`, { 'font-size': 15, 'font-weight': 800, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' });
    o.selR = el('rect', { ...rx(G.case + 2, G.head + 58), y: c.y - hb - 12, height: 2 * hb + 24, rx: 10, fill: 'none', stroke: '#4fa3ff', 'stroke-width': 1.5, 'stroke-dasharray': '5 5', 'pointer-events': 'none' }, cg);
    o.pv = txt(g, X(G.case + 46), c.y + hb - 8, '', { 'font-size': 12, fill: '#fff', 'text-anchor': 'middle', 'font-family': 'var(--mono)', class: 'L-values', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    o.X = X; o.c = c;
    return o;
  }

  resetFx() { this.ex.plume.reset(); }

  update(st, P, dt) {
    const m = this.m, vib = this.scene.vib;
    vib.apply(this.sh, C.x, 390, 1, 0);
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const pOpt = { pr: st.map, adv: st.adv, cr: P.cr, lambda: st.lambda, E };
    const vr = st.vis.rpm;
    m.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `animação em câmera lenta · 1:${Math.round(st.rpm / Math.max(1, vr))}`;
    const wcol = tempColor(st.temp.coolant, 20, 125);
    m.water.forEach((w) => w.setAttribute('fill', wcol));
    const a0 = localAngle(st, P, E, 0) * D2R;
    attr(m.flyMark, { x: (C.x - 3 + 40 * Math.sin(a0)).toFixed(1), opacity: Math.cos(a0) > -0.2 ? 1 : 0.15 });

    for (let k = 0; k < 6; k++) {
      const o = m.cyl[k], c = o.c, sd = c.sd, X = o.X;
      const th = localAngle(st, P, E, k), a = (th % 360) * D2R;
      const pinD = G.R * Math.cos(a);                                              // moente: distância do eixo (com sinal)
      const ppD = pinD + Math.sqrt(G.L * G.L - (G.R * Math.sin(a)) ** 2);          // pino do pistão
      const crown = ppD + G.ch;
      o.piston.setAttribute('transform', `translate(${X(crown).toFixed(1)} 0)`);
      const xp = X(pinD), xq = X(ppD);
      attr(o.web, { x: Math.min(C.x, xp) - 9, width: (Math.abs(xp - C.x) + 18).toFixed(1) });
      attr(o.bigEnd, { x: (xp - 13).toFixed(1) });
      o.rod.setAttribute('d', `M${xp} ${c.y - 9} L${xq} ${c.y - 6} L${xq} ${c.y + 6} L${xp} ${c.y + 9} Z`);
      const cmb = combOn && (k + 1) !== P.failSpark ? 1 : 0;
      const p = cylPressure(th, { ...pOpt, comb: cmb });
      const xa = X(crown - 2), xb = X(G.roof);
      attr(o.gas, { x: Math.min(xa, xb).toFixed(1), width: Math.max(1, Math.abs(xb - xa)).toFixed(1), fill: gasColor(p) });
      o.pv.textContent = `${p < 10 ? fmt(p, 1) : Math.round(p)} bar`;
      const li = intakeLift(th, 1, E) * E.valve.full.lift * S * 1.3, le = exhaustLift(th, E) * E.valve.exh.lift * S * 1.3;
      o.vIn.setAttribute('transform', `translate(${(-sd * li).toFixed(1)} 0)`);
      o.vEx.setAttribute('transform', `translate(${(-sd * le).toFixed(1)} 0)`);
      const lobe = (r, base, l) => { const x0 = X(base), x1 = X(base - 8 - l); attr(r, { x: Math.min(x0, x1).toFixed(1), width: Math.abs(x1 - x0).toFixed(1) }); };
      lobe(o.lobeIn, G.head - 14, li); lobe(o.lobeEx, G.head - 32, le);
      const ds = th - (360 - st.adv);
      o.spark.setAttribute('r', running && cmb && ds >= 0 && ds < 14 ? 7 : 0);
      const xb2 = cmb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
      const fa = cmb && ds > 0 && th < 520 ? Math.min(1, xb2 * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
      const gw = G.roof - crown;
      attr(o.flame, { cx: X(G.roof - gw * 0.35).toFixed(1), rx: (fa * Math.max(8, gw * 0.7)).toFixed(1), ry: (fa * (G.hb - 2)).toFixed(1), 'fill-opacity': fa.toFixed(2) });
      o.tag.setAttribute('fill', STROKE_COL[strokeOf(th)]);
      o.selR.style.display = k === this.scene.cyl ? '' : 'none';
    }
    this.ex.update(st, P, dt);
  }
}
