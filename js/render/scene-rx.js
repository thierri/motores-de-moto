// Desenho do motor Wankel de 2 rotores (SVG), usado pelo Scene quando o motor é o 'rx'.
// Região da esquerda (702 × 784): um rotor grande visto de frente (o escolhido) e o outro, pequeno, ao lado.
// Geometria de verdade: a carcaça é uma epitrocoide; o centro do rotor anda num círculo de raio "e" (a
// excentricidade) em volta do eixo, e o rotor gira a 1/3 da rotação do eixo. Com isso as três pontas nunca
// largam a parede e cada uma das três câmaras faz admissão, compressão, explosão e escape a cada volta
// do rotor, sem válvulas: quem abre e fecha as janelas é o próprio rotor.
import { el, txt, attr, gasColor, tempColor, fmt, fmtInt } from './svg.js';
import { ENGINES } from '../config.js';
import { cylPressure, strokeOf } from '../sim/engine.js';
import { CarExhaust, STROKES, STROKE_COL } from './scene-car.js';
import { wrapShake } from './shake.js';

const E = ENGINES.rx;
const D2R = Math.PI / 180;
const mod = (v, m) => ((v % m) + m) % m;
const FACES = ['A', 'B', 'C'];
const BIG = { x: 262, y: 420, K: 1.85 }, SMALL = { x: 592, y: 252, K: 0.62 };

// ângulos medidos a partir de cima, no sentido horário (o rotor gira no sentido horário)
function makeUnit(g, O, big) {
  const K = O.K, R = E.rotary.R * K, e = E.rotary.e * K;
  const u = { O, K, R, e, big, ch: [], dc: 93.5 * K };
  u.H = (t) => { const a = t * D2R; return [O.x + e * Math.sin(3 * a) + R * Math.sin(a), O.y - (e * Math.cos(3 * a) + R * Math.cos(a))]; };
  const hp = (sc) => {
    let d = '';
    for (let t = 0; t < 360; t += 3) { const [x, y] = u.H(t); d += `${t ? 'L' : 'M'}${(O.x + (x - O.x) * sc).toFixed(1)} ${(O.y + (y - O.y) * sc).toFixed(1)} `; }
    return d + 'Z';
  };
  const wall = 30 * K / 1.85;
  u.g = el('g', big ? {} : { style: 'cursor:pointer' }, g);
  el('path', { d: hp(1.075), fill: '#151d27', stroke: '#5b6d82', 'stroke-width': wall, 'stroke-linejoin': 'round', 'data-comp': 'housing' }, u.g);
  u.water = el('path', { d: hp(1.085), fill: 'none', 'stroke-width': 8 * K / 1.85, 'stroke-dasharray': big ? '26 8' : '9 3', 'data-comp': 'coolant', class: 'L-gas' }, u.g);
  u.ports = el('g', {}, u.g);                       // dutos de admissão e escape (só no grande)
  el('path', { d: hp(1), fill: '#151d27', stroke: '#7e8ea0', 'stroke-width': 1.2, 'data-comp': 'housing' }, u.g);
  for (let i = 0; i < 3; i++) u.ch.push(el('path', { 'data-comp': 'chamber', class: 'L-gas' }, u.g));
  u.flames = [0, 1, 2].map(() => el('ellipse', { rx: 0, ry: 0, fill: 'url(#flame)', 'pointer-events': 'none' }, u.g));
  u.rotor = el('path', { fill: '#aab4c0', stroke: '#2b3542', 'stroke-width': 1.2, 'stroke-linejoin': 'round', 'data-comp': 'rotor' }, u.g);
  u.ring = el('circle', { r: (45 * K).toFixed(1), fill: '#1b2430', stroke: '#4f5b69', 'stroke-width': big ? 5 : 2, 'stroke-dasharray': big ? '4 4' : '2 2', 'data-comp': 'rotorGear' }, u.g);
  u.lobe = el('circle', { r: (37 * K).toFixed(1), fill: '#8d99a8', 'fill-opacity': 0.55, stroke: '#c3cad4', 'stroke-width': 1, 'data-comp': 'eshaft' }, u.g);
  el('circle', { cx: O.x, cy: O.y, r: (30 * K).toFixed(1), fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': big ? 5 : 2, 'stroke-dasharray': big ? '4 4' : '2 2', 'data-comp': 'statGear' }, u.g);
  el('circle', { cx: O.x, cy: O.y, r: (17 * K).toFixed(1), fill: '#5d6b7c', stroke: '#c3cad4', 'stroke-width': 1, 'data-comp': 'eshaft' }, u.g);
  u.arm = el('line', { x1: O.x, y1: O.y, stroke: '#f2b632', 'stroke-width': big ? 4 : 2, 'stroke-linecap': 'round', 'pointer-events': 'none' }, u.g);
  u.apex = [0, 1, 2].map(() => el('circle', { r: big ? 5.5 : 2.2, fill: '#e6edf3', stroke: '#2b3542', 'stroke-width': 0.8, 'data-comp': 'apex' }, u.g));
  if (big) u.let = FACES.map((s) => txt(u.g, 0, 0, s, { 'font-size': 20, 'font-weight': 800, fill: '#0b1118', 'text-anchor': 'middle', 'pointer-events': 'none' }));
  return u;
}

// alpha: ângulo do eixo excêntrico para este rotor (0–1080°); devolve o tempo e a pressão de cada câmara
function updateUnit(u, alpha, st, P, comb) {
  const { O, R, e } = u, b = alpha / 3;
  const cx = O.x + e * Math.sin(alpha * D2R), cy = O.y - e * Math.cos(alpha * D2R);
  const A = [0, 1, 2].map((i) => u.H(b + 120 * i));
  const pt = (d, ang) => [cx + d * Math.sin(ang * D2R), cy - d * Math.cos(ang * D2R)];
  const F = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const out = [];
  let rd = `M${F(A[0])}`;
  for (let i = 0; i < 3; i++) {
    const gam = b + 120 * i + 60, ctrl = pt(u.dc, gam), nx = A[(i + 1) % 3];
    rd += ` Q${F(ctrl)} ${F(nx)}`;
    const phi = mod(alpha + 450 + 360 * i, 1080), th = phi * 2 / 3;
    const p = cylPressure(th, { pr: st.map, adv: st.adv, cr: P.cr, lambda: st.lambda, E, comb });
    let d = `M${F(A[i])}`;
    for (let s = 1; s < 12; s++) d += ` L${F(u.H(b + 120 * i + 10 * s))}`;
    d += ` L${F(nx)} Q${F(ctrl)} ${F(A[i])} Z`;
    attr(u.ch[i], { d, fill: gasColor(p) });
    // chama: da faísca (pouco antes do ponto de menor volume) até o meio da expansão
    const ds = th - (360 - st.adv);
    const xb = comb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 60), 3)) : 0;
    const fa = comb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
    const fc = pt(R * 0.8, gam);
    attr(u.flames[i], { cx: fc[0].toFixed(1), cy: fc[1].toFixed(1), rx: (fa * R * 0.5).toFixed(1), ry: (fa * R * 0.2).toFixed(1), 'fill-opacity': fa.toFixed(2), transform: `rotate(${(gam + 90).toFixed(1)} ${fc[0].toFixed(1)} ${fc[1].toFixed(1)})` });
    attr(u.apex[i], { cx: A[i][0].toFixed(1), cy: A[i][1].toFixed(1), fill: P.failApex ? '#ff6b6b' : '#e6edf3' });
    if (u.let) { const q = pt(R * 0.585, gam); attr(u.let[i], { x: q[0].toFixed(1), y: (q[1] + 7).toFixed(1) }); }
    out.push({ th, p, sk: strokeOf(th), spark: comb && ds >= 0 && ds < 16 });
  }
  u.rotor.setAttribute('d', rd + ' Z');
  attr(u.ring, { cx: cx.toFixed(1), cy: cy.toFixed(1) });
  attr(u.lobe, { cx: cx.toFixed(1), cy: cy.toFixed(1) });
  attr(u.arm, { x2: (O.x + (cx - O.x) * 2.1).toFixed(1), y2: (O.y + (cy - O.y) * 2.1).toFixed(1) });
  return out;
}

export class RXView {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.flowIn = 0; this.flowEx = 0; this.turns = 0;
    const ge = el('g', {}, g);
    this.build(ge);
    this.sh = wrapShake(ge);
    this.ex = new CarExhaust(g, E, { title: 'Escape: um tubo por rotor' });
  }

  build(g) {
    const m = this.m = {};
    txt(g, 24, 40, 'O Wankel por dentro', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    txt(g, 24, 64, 'Sem pistões nem válvulas: um rotor triangular gira dentro da carcaça.', { 'font-size': 14, fill: '#8da0b6' });
    m.slow = txt(g, 680, 86, '', { 'font-size': 13, fill: '#8da0b6', 'text-anchor': 'end', 'font-family': 'var(--mono)' });

    m.small = makeUnit(g, SMALL, false);
    const u = m.big = makeUnit(g, BIG, true);

    // dutos: admissão em cima à esquerda, escape embaixo à esquerda (as janelas ficam na parede da carcaça)
    const pi = u.H(303), pe = u.H(237);
    const pipe = (d, comp) => {
      el('path', { d, fill: 'none', stroke: '#5b6d82', 'stroke-width': 36, 'stroke-linecap': 'butt', 'data-comp': comp }, u.ports);
      const gas = el('path', { d, fill: 'none', 'stroke-width': 30, 'data-comp': comp, class: 'L-gas' }, u.ports);
      const flow = el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, u.ports);
      return { gas, flow };
    };
    m.in = pipe(`M46 150 V250 C46 300 70 326 ${(pi[0] + 12).toFixed(1)} ${(pi[1] + 6).toFixed(1)}`, 'intake');
    m.ex = pipe(`M${(pe[0] + 12).toFixed(1)} ${(pe[1] - 6).toFixed(1)} C70 514 46 540 46 590 V700`, 'header');
    const af = el('g', { 'data-comp': 'airbox' }, u.ports);
    el('rect', { x: 14, y: 100, width: 64, height: 52, rx: 10, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, af);
    m.filter = el('rect', { x: 22, y: 108, width: 48, height: 36, rx: 5, fill: 'none', stroke: '#c9b26a', 'stroke-width': 1, 'stroke-dasharray': '3 3', 'data-comp': 'filter' }, af);
    const tb = el('g', { 'data-comp': 'throttle' }, u.ports);
    m.butterfly = el('line', { x1: 31, y1: 214, x2: 61, y2: 214, stroke: '#e6edf3', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, tb);
    el('circle', { cx: 46, cy: 214, r: 3, fill: '#e6edf3' }, tb);

    // velas: duas por rotor, na "cintura" do lado direito (a de baixo dispara primeiro)
    m.plugs = [102, 78].map((t) => {
      const p = u.H(t), sp = el('g', { 'data-comp': 'spark' }, g);
      el('rect', { x: p[0] + 4, y: p[1] - 4.5, width: 44, height: 9, fill: '#cfd6de', stroke: '#2b3542', 'stroke-width': 0.8 }, sp);
      el('rect', { x: p[0] + 44, y: p[1] - 10, width: 22, height: 20, rx: 4, fill: '#20262e', stroke: '#5b6d82', 'stroke-width': 1 }, sp);
      return el('circle', { cx: p[0] - 6, cy: p[1], r: 0, fill: '#fffbd0', filter: 'url(#glow)', 'pointer-events': 'none' }, g);
    });

    // legenda: o que cada câmara do rotor grande está fazendo
    const lg = el('g', { class: 'noshake' }, g);
    m.rows = FACES.map((s, k) => {
      const r = el('rect', { x: 500, y: 466 + k * 34, width: 132, height: 27, rx: 13.5 }, lg);
      const t = txt(lg, 566, 484.5 + k * 34, '', { 'font-size': 12, 'font-weight': 700, fill: '#0b1118', 'text-anchor': 'middle' });
      const p = txt(lg, 696, 484.5 + k * 34, '', { 'font-size': 12, fill: '#fff', 'text-anchor': 'end', 'font-family': 'var(--mono)', class: 'L-values' });
      return { r, t, p, s };
    });
    m.ratio = txt(lg, 594, 590, '', { 'font-size': 13, fill: '#c2cfdc', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    txt(lg, 594, 612, 'o eixo dá 3 voltas', { 'font-size': 12.5, fill: '#8da0b6', 'text-anchor': 'middle' });
    txt(lg, 594, 630, 'a cada volta do rotor', { 'font-size': 12.5, fill: '#8da0b6', 'text-anchor': 'middle' });
    m.smallT = txt(lg, SMALL.x, SMALL.y - 92, '', { 'font-size': 14, 'font-weight': 700, fill: '#e6edf3', 'text-anchor': 'middle' });
    m.bigT = txt(lg, BIG.x, 150, '', { 'font-size': 15, 'font-weight': 700, fill: '#e6edf3', 'text-anchor': 'middle' });
    txt(lg, SMALL.x, SMALL.y + 104, 'meia volta do eixo atrás', { 'font-size': 12, fill: '#8da0b6', 'text-anchor': 'middle' });

    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, s, a, px, py) => {
      if (px != null) { el('path', { d: `M${x + (a === 'end' ? 4 : a === 'middle' ? 0 : -4)} ${y - 14} L${px} ${py}`, stroke: '#8da0b6', 'stroke-width': 0.8, 'stroke-opacity': 0.6, fill: 'none' }, L); el('circle', { cx: px, cy: py, r: 2, fill: '#8da0b6' }, L); }
      txt(L, x, y, s, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    };
    lab(84, 186, 'Admissão', 'start');
    lab(84, 664, 'Escape', 'start');
    lab(498, u.H(78)[1] - 18, 'Velas', 'end');
    lab(150, 716, 'Eixo excêntrico', 'middle', BIG.x - 8, BIG.y + 14);
    lab(330, 716, 'Engrenagem fixa', 'middle', BIG.x + 40, BIG.y + 30);
    lab(500, 700, 'Carcaça com água', 'middle', BIG.x + 150, BIG.y + 150);
    m.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    const vt = (x, y, a = 'start') => txt(m.vals, x, y, '', { 'font-size': 12.5, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    m.vMap = vt(84, 206); m.vEgt = vt(84, 684);
    m.small.g.addEventListener('click', () => this.scene.setCyl(1 - this.scene.cyl));
  }

  resetFx() { this.ex.plume.reset(); }

  update(st, P, dt) {
    const m = this.m, vib = this.scene.vib;
    vib.apply(this.sh, BIG.x, BIG.y, 1, 1);
    const sel = this.scene.cyl ? 1 : 0, off = E.firing.rotary;
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const al = (k) => mod(st.vis.long - off[k] - 450, 1080);
    const cmb = (k) => (combOn && (k + 1) !== P.failSpark ? 1 : 0);
    const ch = updateUnit(m.big, al(sel), st, P, cmb(sel));
    updateUnit(m.small, al(1 - sel), st, P, cmb(1 - sel));
    m.bigT.textContent = `Rotor ${sel + 1}`;
    m.smallT.textContent = `Rotor ${2 - sel}`;
    const vr = st.vis.rpm;
    m.slow.textContent = st.rpm < 30 ? '' : P.anim === 'real' ? 'animação em tempo real' : `câmera lenta · 1:${Math.round(st.rpm / Math.max(1, vr))}`;
    const wcol = tempColor(st.temp.coolant, 20, 125);
    m.big.water.setAttribute('stroke', wcol); m.small.water.setAttribute('stroke', wcol);
    ch.forEach((c, i) => {
      attr(m.rows[i].r, { fill: STROKE_COL[c.sk] });
      m.rows[i].t.textContent = `${FACES[i]} · ${STROKES[c.sk]}`;
      m.rows[i].p.textContent = `${c.p < 10 ? fmt(c.p, 1) : Math.round(c.p)} bar`;
    });
    const sp = ch.some((c) => c.spark);
    m.plugs.forEach((p, k) => p.setAttribute('r', sp ? (k ? 6 : 9) : 0));
    m.ratio.textContent = `eixo ${fmtInt(Math.round(st.rpm / 10) * 10)} · rotor ${fmtInt(Math.round(st.rpm / 30) * 10)} rpm`;

    // dutos
    m.in.gas.setAttribute('stroke', gasColor(st.map * 1.013));
    m.ex.gas.setAttribute('stroke', tempColor(st.temp.egt, 20, 1000));
    const spd = Math.min(400, vr * 0.3 + 20);
    this.flowIn -= spd * (0.25 + 0.75 * st.pr) * dt; this.flowEx -= spd * dt;
    m.in.flow.setAttribute('stroke-dashoffset', (this.flowIn % 14).toFixed(1));
    m.ex.flow.setAttribute('stroke-dashoffset', (this.flowEx % 14).toFixed(1));
    m.in.flow.style.opacity = m.ex.flow.style.opacity = st.rpm > 30 ? 1 : 0;
    m.butterfly.setAttribute('transform', `rotate(${(8 + st.tps * 82).toFixed(1)} 46 214)`);
    m.filter.setAttribute('stroke', P.failFilter ? '#7a5a2a' : '#c9b26a');
    m.filter.setAttribute('fill', P.failFilter ? '#4a3a20' : 'none');
    m.vMap.textContent = `${Math.round(st.map * 101.3)} kPa`;
    m.vEgt.textContent = `${Math.round(st.temp.egt)} °C`;
    this.ex.update(st, P, dt);
  }
}
