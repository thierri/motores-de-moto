// Partes do desenho comuns aos motores de carro:
//   CoolingView – o sistema de arrefecimento (região de cima à direita): radiador com ventoinha, mangueiras,
//                 válvula termostática, bomba d'água, reservatório de expansão e o radiador do ar quente
//   CarExhaust  – o escapamento (região de baixo à direita), com um pulso por cilindro ou rotor
import { el, txt, attr, tempColor, fmt } from './svg.js';
import { profile } from '../config.js';
import { localAngle } from '../sim/engine.js';
import { drawMuffler, mufKey, ExhaustPlume } from './exhaust-common.js';

export const STROKES = ['Admissão', 'Compressão', 'Explosão', 'Escape'];
export const STROKE_COL = ['#3d7fe0', '#2bb39a', '#f08a2c', '#8b7d70'];
const D2R = Math.PI / 180;
const wc = (t) => tempColor(t, 20, 125);

const RAD = { x: 742, y: 152, w: 210, h: 246 };
const FAN = { x: 847, y: 275, r: 92 };
const BL = { x: 1150, y: 170, w: 150, h: 230 };
const TH = { x: 1128, y: 196 }, PU = { x: 1128, y: 372 };
const BAR = { x: 744, y: 470, w: 632, t0: 20, t1: 130 };
const bx = (t) => BAR.x + BAR.w * Math.max(0, Math.min(1, (t - BAR.t0) / (BAR.t1 - BAR.t0)));

export class CoolingView {
  constructor(scene, g) {
    this.scene = scene;
    this.g = g;
    this.fanA = 0; this.pumpA = 0; this.ph = 0; this.phB = 0; this.phH = 0;
    this.build();
  }

  build() {
    const g = this.g, c = this.c = {};
    const defs = el('defs', {}, g);
    const rg = el('linearGradient', { id: 'radG', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    c.rg0 = el('stop', { offset: '0', 'stop-color': '#3878e6' }, rg);
    c.rg1 = el('stop', { offset: '1', 'stop-color': '#3878e6' }, rg);

    txt(g, 724, 40, 'Sistema de arrefecimento', { 'font-size': 20, 'font-weight': 700, fill: '#e6edf3' });
    c.sub = txt(g, 724, 64, '', { 'font-size': 14, fill: '#8da0b6' });

    // ---------- mangueiras (atrás de tudo) ----------
    const hose = (d, comp, w = 16) => {
      const gg = el('g', { 'data-comp': comp }, g);
      el('path', { d, fill: 'none', stroke: '#5b6d82', 'stroke-width': w + 6, 'stroke-linecap': 'round' }, gg);
      const gas = el('path', { d, fill: 'none', 'stroke-width': w, 'stroke-linecap': 'round', class: 'L-gas' }, gg);
      const flow = el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, gg);
      return { gas, flow };
    };
    c.up = hose(`M${TH.x - 16} ${TH.y} C1060 ${TH.y} 1040 172 ${RAD.x + RAD.w} 172`, 'hoses');
    c.low = hose(`M${RAD.x + RAD.w} 380 C1030 380 1050 ${PU.y} ${PU.x - 18} ${PU.y}`, 'hoses');
    c.byp = hose(`M${TH.x} ${TH.y + 16} V${PU.y - 20}`, 'bypass', 8);
    c.exp = hose(`M1012 128 C985 128 968 146 ${RAD.x + RAD.w - 6} 160`, 'expTank', 5);
    c.ht1 = hose(`M${BL.x + BL.w} 250 H1340`, 'heaterCore', 8);
    c.ht2 = hose(`M1340 300 H${BL.x + BL.w}`, 'heaterCore', 8);

    // ---------- radiador (visto de frente) com a ventoinha ----------
    const rad = el('g', { 'data-comp': 'radiator' }, g);
    el('rect', { x: RAD.x - 6, y: RAD.y - 10, width: RAD.w + 12, height: RAD.h + 20, rx: 8, fill: '#1b2430', stroke: '#5b6d82', 'stroke-width': 1.2 }, rad);
    c.core = el('rect', { x: RAD.x, y: RAD.y + 12, width: RAD.w, height: RAD.h - 24, fill: 'url(#radG)', class: 'L-gas' }, rad);
    let mesh = '';
    for (let x = RAD.x + 7; x < RAD.x + RAD.w; x += 7) mesh += `M${x} ${RAD.y + 12} V${RAD.y + RAD.h - 12} `;
    el('path', { d: mesh, stroke: '#0b1118', 'stroke-width': 2.2, 'stroke-opacity': 0.55, 'pointer-events': 'none' }, rad);
    c.tankT = el('rect', { x: RAD.x, y: RAD.y, width: RAD.w, height: 14, rx: 4, class: 'L-gas' }, rad);
    c.tankB = el('rect', { x: RAD.x, y: RAD.y + RAD.h - 14, width: RAD.w, height: 14, rx: 4, class: 'L-gas' }, rad);
    c.clog = el('rect', { x: RAD.x, y: RAD.y + 12, width: RAD.w, height: RAD.h - 24, fill: '#3a2f1c', 'fill-opacity': 0, 'pointer-events': 'none' }, rad);

    const fan = el('g', { 'data-comp': 'fan' }, g);
    el('circle', { cx: FAN.x, cy: FAN.y, r: FAN.r + 6, fill: '#0b1118', 'fill-opacity': 0.25, stroke: '#9aa7b6', 'stroke-width': 3 }, fan);
    for (const a of [45, 135, 225, 315]) el('line', { x1: FAN.x, y1: FAN.y, x2: FAN.x + (FAN.r + 6) * Math.cos(a * D2R), y2: FAN.y + (FAN.r + 6) * Math.sin(a * D2R), stroke: '#5b6d82', 'stroke-width': 4 }, fan);
    c.blur = el('circle', { cx: FAN.x, cy: FAN.y, r: FAN.r - 22, fill: 'none', stroke: '#dfe7ef', 'stroke-width': 40, 'stroke-opacity': 0, 'pointer-events': 'none' }, fan);
    c.blades = el('g', {}, fan);
    for (let k = 0; k < 7; k++) {
      const a = k * 360 / 7;
      el('path', { d: `M${FAN.x} ${FAN.y - 16} C${FAN.x + 26} ${FAN.y - 40} ${FAN.x + 34} ${FAN.y - 72} ${FAN.x + 12} ${FAN.y - FAN.r + 4} C${FAN.x - 8} ${FAN.y - FAN.r + 2} ${FAN.x - 22} ${FAN.y - 74} ${FAN.x - 10} ${FAN.y - 16} Z`,
        fill: '#c3cad4', 'fill-opacity': 0.82, stroke: '#2b3542', 'stroke-width': 1, transform: `rotate(${a.toFixed(1)} ${FAN.x} ${FAN.y})` }, c.blades);
    }
    el('circle', { cx: FAN.x, cy: FAN.y, r: 20, fill: '#3a4859', stroke: '#9aa7b6', 'stroke-width': 1.5 }, fan);
    c.fanLed = el('circle', { cx: FAN.x, cy: FAN.y, r: 7, fill: '#26313d' }, fan);

    // ---------- reservatório de expansão ----------
    const tank = el('g', { 'data-comp': 'expTank' }, g);
    el('rect', { x: 1010, y: 92, width: 66, height: 54, rx: 9, fill: '#1b2430', stroke: '#9aa7b6', 'stroke-width': 1.2 }, tank);
    c.lvl = el('rect', { x: 1013, width: 60, rx: 6, class: 'L-gas' }, tank);
    el('path', { d: 'M1058 118 h14 M1058 134 h14', stroke: '#9aa7b6', 'stroke-width': 1 }, tank);
    el('rect', { x: 1030, y: 82, width: 26, height: 12, rx: 3, fill: '#20262e', stroke: '#9aa7b6', 'stroke-width': 1 }, tank);
    c.steamG = el('g', { 'pointer-events': 'none' }, g);
    c.steam = Array.from({ length: 26 }, () => ({ e: el('circle', { r: 0, fill: '#eef3f8' }, c.steamG), age: 9, life: 1 }));

    // ---------- motor (bloco com a camisa d'água) ----------
    const blk = el('g', { 'data-comp': 'coolant' }, g);
    el('rect', { x: BL.x, y: BL.y, width: BL.w, height: BL.h, rx: 12, fill: '#253140', stroke: '#5b6d82', 'stroke-width': 1.2 }, blk);
    const jd = `M${BL.x + 4} ${PU.y} H${BL.x + BL.w - 22} V${TH.y} H${BL.x + 4}`;
    c.jacket = el('path', { d: jd, fill: 'none', 'stroke-width': 16, 'stroke-linejoin': 'round', class: 'L-gas' }, blk);
    c.jFlow = el('path', { d: jd, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '3 11', 'stroke-opacity': 0.8, 'pointer-events': 'none', class: 'L-flow' }, blk);
    c.cyls = [0, 1].map((k) => el('rect', { x: BL.x + 20 + k * 54, y: TH.y + 22, width: 42, height: PU.y - TH.y - 44, rx: 8, fill: '#151d27', stroke: '#7e8ea0', 'stroke-width': 1 }, blk));
    c.heat = [0, 1].map((k) => el('ellipse', { cx: BL.x + 41 + k * 54, cy: TH.y + 60, rx: 15, ry: 22, fill: 'url(#flame)', 'fill-opacity': 0, 'pointer-events': 'none' }, blk));

    // válvula termostática
    const th = el('g', { 'data-comp': 'thermostat' }, g);
    el('circle', { cx: TH.x, cy: TH.y, r: 19, fill: '#2f3a47', stroke: '#c3cad4', 'stroke-width': 1.5 }, th);
    c.thGate = el('line', { x1: TH.x, y1: TH.y - 14, x2: TH.x, y2: TH.y + 14, stroke: '#f2b632', 'stroke-width': 5, 'stroke-linecap': 'round' }, th);
    el('circle', { cx: TH.x, cy: TH.y, r: 3.5, fill: '#f2b632' }, th);
    // bomba d'água
    const pu = el('g', { 'data-comp': 'waterPump' }, g);
    el('circle', { cx: PU.x, cy: PU.y, r: 21, fill: '#2f3a47', stroke: '#c3cad4', 'stroke-width': 1.5 }, pu);
    c.imp = el('g', {}, pu);
    for (let k = 0; k < 6; k++) el('path', { d: `M${PU.x} ${PU.y} q8 -6 4 -16`, fill: 'none', stroke: '#c3cad4', 'stroke-width': 3, 'stroke-linecap': 'round', transform: `rotate(${k * 60} ${PU.x} ${PU.y})` }, c.imp);

    // radiador do ar quente (cabine)
    const hc = el('g', { 'data-comp': 'heaterCore' }, g);
    c.hcore = el('rect', { x: 1336, y: 232, width: 44, height: 86, rx: 5, stroke: '#9aa7b6', 'stroke-width': 1.2, class: 'L-gas' }, hc);
    let hm = '';
    for (let y = 240; y < 316; y += 8) hm += `M1336 ${y} H1380 `;
    el('path', { d: hm, stroke: '#0b1118', 'stroke-width': 2, 'stroke-opacity': 0.5, 'pointer-events': 'none' }, hc);
    c.hwave = [0, 1, 2].map((k) => el('path', { d: `M${1344 + k * 12} 226 q-6 -8 0 -16 q6 -8 0 -16`, fill: 'none', stroke: '#ff9a52', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-opacity': 0, 'pointer-events': 'none' }, hc));

    // ---------- termômetro ----------
    const bar = el('g', { class: 'noshake' }, g);
    for (let k = 0; k < 44; k++) {
      const t = BAR.t0 + (k + 0.5) / 44 * (BAR.t1 - BAR.t0);
      el('rect', { x: (BAR.x + k * BAR.w / 44).toFixed(1), y: BAR.y, width: (BAR.w / 44 + 0.6).toFixed(1), height: 14, fill: wc(t) }, bar);
    }
    const tick = (t, s, up) => {
      el('line', { x1: bx(t), y1: BAR.y - 5, x2: bx(t), y2: BAR.y + 19, stroke: '#e6edf3', 'stroke-width': 1.4 }, bar);
      txt(bar, bx(t), up ? BAR.y - 26 : BAR.y + 50, s, { 'font-size': 11.5, fill: '#8da0b6', 'text-anchor': 'middle' });
    };
    tick(88, '88° abre a termostática', true);
    tick(98, '98° liga a ventoinha', false);
    tick(120, '120° ferve', true);
    c.mkE = el('path', { d: 'M0 0 l-8 -12 h16 Z', fill: '#fff', stroke: '#0b1118', 'stroke-width': 1 }, bar);
    c.mkR = el('path', { d: 'M0 0 l-7 11 h14 Z', fill: '#9db6d8', stroke: '#0b1118', 'stroke-width': 1 }, bar);

    // ---------- nomes e valores ----------
    const L = el('g', { class: 'L-labels', 'pointer-events': 'none' }, g);
    const lab = (x, y, s, a = 'middle') => txt(L, x, y, s, { 'font-size': 12.5, fill: '#aebdcc', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    lab(1094, 86, 'Reservatório', 'end');
    lab(1092, 228, 'Termostática', 'end');
    lab(1092, 412, 'Bomba d\'água', 'end');
    lab(1380, 340, 'Ar quente', 'end');
    c.vals = el('g', { class: 'L-values', 'pointer-events': 'none' }, g);
    const vt = (x, y, a = 'middle', fs = 14) => txt(c.vals, x, y, '', { 'font-size': fs, fill: '#fff', 'font-family': 'var(--mono)', 'text-anchor': a, 'paint-order': 'stroke', stroke: '#0b1118', 'stroke-width': 3 });
    c.vRad = vt(FAN.x, RAD.y + RAD.h + 32);
    c.vFan = vt(FAN.x, RAD.y - 20);
    c.vEng = vt(BL.x + BL.w / 2, BL.y + BL.h + 26);
    c.vEngT = vt(BL.x + BL.w / 2 - 11, BL.y - 12, 'middle', 13);
    c.vTh = vt(1092, 246, 'end', 12.5);
    c.vLvl = vt(1084, 124, 'start', 12.5);
  }

  resetFx() { for (const q of this.c.steam) { q.age = 9; q.e.setAttribute('r', 0); } }

  update(st, P, dt) {
    const c = this.c, T = st.temp, E = profile(P);
    const run = st.running && !st.broken;
    const pump = run ? 0.3 + 0.7 * Math.min(1, st.rpm / (0.5 * E.limit)) : 0;
    const th = st.thermo, hot = wc(T.coolant), lvl = Math.max(0, Math.min(1, st.coolLvl));
    const dry = lvl < 0.3;

    // cores: lado quente (saída do motor) e lado frio (volta do radiador)
    const radIn = T.rad + (T.coolant - T.rad) * 0.55 * th, radOut = T.rad - (T.rad - T.amb) * 0.25;
    c.rg0.setAttribute('stop-color', wc(radIn));
    c.rg1.setAttribute('stop-color', wc(radOut));
    c.tankT.setAttribute('fill', wc(radIn));
    c.tankB.setAttribute('fill', wc(radOut));
    c.up.gas.setAttribute('stroke', wc(th > 0.05 ? T.coolant : (T.coolant + T.rad) / 2));
    c.low.gas.setAttribute('stroke', wc(radOut));
    c.byp.gas.setAttribute('stroke', hot);
    c.jacket.setAttribute('stroke', dry ? '#2d3a48' : hot);
    c.exp.gas.setAttribute('stroke', wc(T.rad));
    const hc = st.heater && st.key ? T.coolant : T.amb + 6;
    c.ht1.gas.setAttribute('stroke', wc(hc)); c.ht2.gas.setAttribute('stroke', wc(hc - 12)); c.hcore.setAttribute('fill', wc(hc - 6));
    c.clog.setAttribute('fill-opacity', P.failRad ? 0.72 : 0);

    // fluxo: pelo radiador só com a termostática aberta; fechada, a água dá a volta por dentro do motor
    const fl = pump * (dry ? 0.1 : 1);
    this.ph -= 150 * fl * th * dt; this.phB -= 150 * fl * (1 - th) * dt; this.phH -= 150 * fl * dt;
    for (const h of [c.up, c.low]) { h.flow.setAttribute('stroke-dashoffset', (this.ph % 14).toFixed(1)); h.flow.style.opacity = fl * th > 0.03 ? 1 : 0; }
    c.byp.flow.setAttribute('stroke-dashoffset', (this.phB % 14).toFixed(1)); c.byp.flow.style.opacity = fl * (1 - th) > 0.03 ? 1 : 0;
    c.jFlow.setAttribute('stroke-dashoffset', (this.phH % 14).toFixed(1)); c.jFlow.style.opacity = fl > 0.03 ? 1 : 0;
    c.exp.flow.style.opacity = 0;
    const hOn = st.heater && st.key && fl > 0.03;
    for (const h of [c.ht1, c.ht2]) { h.flow.setAttribute('stroke-dashoffset', (this.phH % 14).toFixed(1)); h.flow.style.opacity = hOn ? 1 : 0; }
    c.hwave.forEach((w, k) => w.setAttribute('stroke-opacity', st.heater && st.key ? (0.45 + 0.4 * Math.sin(st.t * 5 + k * 1.7)).toFixed(2) : 0));

    // ventoinha: gira quando liga (e um pouco com o vento da estrada)
    const spd = st.fanSpd;
    this.fanA = (this.fanA + (spd * 760 + Math.min(120, st.v * 4) * (spd < 0.05 ? 1 : 0)) * dt) % 360;
    c.blades.setAttribute('transform', `rotate(${this.fanA.toFixed(1)} ${FAN.x} ${FAN.y})`);
    c.blades.setAttribute('opacity', (1 - 0.35 * Math.min(1, spd)).toFixed(2));
    c.blur.setAttribute('stroke-opacity', (0.1 * Math.min(1.9, spd)).toFixed(3));
    c.fanLed.setAttribute('fill', P.fan === 'off' ? '#ff4d4d' : spd > 0.1 ? '#3ecf72' : '#26313d');
    c.vFan.textContent = P.fan === 'off' ? 'Ventoinha QUEIMADA' : spd > 1.2 ? 'Ventoinha: 2ª velocidade' : st.fan && st.key ? 'Ventoinha LIGADA' : 'Ventoinha desligada';
    c.vFan.setAttribute('fill', P.fan === 'off' ? '#ff6b6b' : st.fan && st.key ? '#3ecf72' : '#fff');

    // termostática e bomba
    c.thGate.setAttribute('transform', `rotate(${(90 * th).toFixed(1)} ${TH.x} ${TH.y})`);
    this.pumpA = (this.pumpA + Math.min(900, st.rpm * 0.35) * dt) % 360;
    c.imp.setAttribute('transform', `rotate(${this.pumpA.toFixed(1)} ${PU.x} ${PU.y})`);

    // reservatório, vapor e explosões dentro do bloco
    const lh = 46 * lvl;
    attr(c.lvl, { y: (143 - lh).toFixed(1), height: lh.toFixed(1), fill: wc(T.rad) });
    const comb = run && st.comb > 0 && !st.cut.any;
    c.heat.forEach((h, k) => h.setAttribute('fill-opacity', comb ? (0.35 + 0.5 * Math.min(1, st.map) * (0.6 + 0.4 * Math.sin(st.t * 31 + k * 3))).toFixed(2) : 0));
    this.steamAcc = (this.steamAcc || 0) + st.steam * 38 * dt;
    while (this.steamAcc >= 1) {
      this.steamAcc -= 1;
      const q = c.steam.find((s) => s.age >= s.life);
      if (!q) break;
      q.age = 0; q.life = 0.9 + 0.8 * Math.random();
      q.x = 1043 + (Math.random() - 0.5) * 10; q.y = 80;
      q.vx = (Math.random() - 0.5) * 50; q.vy = -(60 + 70 * Math.random());
    }
    for (const q of c.steam) {
      if (q.age >= q.life) continue;
      q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const u = Math.min(1, q.age / q.life);
      if (u >= 1) { q.e.setAttribute('r', 0); continue; }
      attr(q.e, { cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (4 + 16 * u).toFixed(1), 'fill-opacity': (0.6 * (1 - u)).toFixed(2) });
    }

    // textos
    const tc = Math.round(T.coolant);
    c.sub.textContent = st.broken ? 'Motor danificado.'
      : st.steam > 0.15 ? 'FERVENDO: a água vira vapor e escapa pelo reservatório!'
      : dry ? 'Quase sem água: o calor não tem para onde ir.'
      : T.coolant > 116 ? 'Superaquecendo: o radiador não está dando conta.'
      : !run ? 'Motor desligado: a água está parada.'
      : th < 0.08 ? 'Motor frio: termostática fechada, a água circula só dentro do motor.'
      : st.fan && st.key ? 'Termostática aberta e ventoinha ligada: o radiador joga o calor no ar.'
      : 'Termostática aberta: a água quente passa pelo radiador e volta fria.';
    c.sub.setAttribute('fill', T.coolant > 116 ? '#ff6b6b' : '#8da0b6');
    c.vRad.textContent = `Radiador ${Math.round(T.rad)} °C · ar ${Math.round(T.amb)} °C${st.v > 2 ? ` · vento ${Math.round(st.v * 3.6)} km/h` : ''}`;
    c.vEng.textContent = `Motor ${tc} °C`;
    c.vEng.setAttribute('fill', T.coolant > E.hot ? '#ff6b6b' : T.coolant < 60 ? '#7fb6ff' : '#fff');
    c.vEngT.textContent = st.ac && run ? 'A/C ligado' : '';
    c.vTh.textContent = P.thermo === 'closed' ? 'TRAVADA fechada' : P.thermo === 'open' ? 'TRAVADA aberta' : th < 0.05 ? 'fechada' : `aberta ${Math.round(th * 100)}%`;
    c.vTh.setAttribute('fill', P.thermo !== 'ok' ? '#ff6b6b' : '#fff');
    c.vLvl.textContent = `${Math.round(lvl * 100)}%`;
    c.vLvl.setAttribute('fill', lvl < 0.6 ? '#ff6b6b' : '#fff');
    c.mkE.setAttribute('transform', `translate(${bx(T.coolant).toFixed(1)} ${BAR.y - 1})`);
    c.mkR.setAttribute('transform', `translate(${bx(T.rad).toFixed(1)} ${BAR.y + 15})`);
  }
}

// Escapamento de carro: um tubo por cilindro (ou rotor), juntando em um ou dois grupos, e o silencioso.
// Desenhado com as mesmas coordenadas dos escapes das motos (grupo deslocado 240 px para a esquerda).
export class CarExhaust {
  constructor(g, E, o = {}) {
    this.E = E;
    const gg = this.gg = el('g', { 'data-comp': 'exhaustSys', transform: 'translate(-240 0)', class: 'noshake' }, g);
    txt(gg, 990, 558, o.title || 'Escapamento', { 'font-size': 15, 'font-weight': 700, fill: '#e6edf3' });
    this.name = txt(gg, 990, 576, '', { 'font-size': 12, fill: '#8da0b6' });
    const n = this.n = E.snd.units || E.cyl;
    const yTop = 604, mx = 1067, my = 700;
    const xs = Array.from({ length: n }, (_, i) => 1006 + (n > 1 ? i * 122 / (n - 1) : 61));
    const grp = o.groups || xs.map(() => mx);       // x do ponto de junção de cada tubo
    this.paths = xs.map((x, i) => `M${x} ${yTop} C${x} ${yTop + 34} ${grp[i]} ${yTop + 30} ${grp[i]} ${yTop + 58} C${grp[i]} ${yTop + 78} ${mx} ${my - 30} ${mx} ${my} C${mx} ${my + 30} ${mx + 40} ${my + 42} ${mx + 90} ${my + 42} H1250`);
    this.paths.forEach((d) => el('path', { d, fill: 'none', 'stroke-width': 13, 'stroke-linecap': 'round', stroke: '#5b6d82' }, gg));
    this.core = this.paths.map((d) => el('path', { d, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'L-gas' }, gg));
    this.meas = this.paths.map((d) => el('path', { d, fill: 'none', stroke: 'none' }, gg));
    xs.forEach((x, i) => txt(gg, x, yTop - 8, `${i + 1}`, { 'font-size': 12, 'font-weight': 700, fill: '#aebdcc', 'text-anchor': 'middle' }));
    if (o.turbo) {
      // a turbina fica no caminho dos gases, logo depois do coletor
      const t = el('g', { 'data-comp': 'turbine' }, gg);
      el('circle', { cx: mx, cy: my - 4, r: 17, fill: '#2a3644', stroke: '#c3cad4', 'stroke-width': 1.5 }, t);
      this.tw = el('g', {}, t);
      for (let k = 0; k < 8; k++) el('path', { d: `M${mx} ${my - 4} q7 -4 4 -13`, fill: 'none', stroke: '#f2b632', 'stroke-width': 2.2, 'stroke-linecap': 'round', transform: `rotate(${k * 45} ${mx} ${my - 4})` }, this.tw);
      this.tx = mx; this.ty = my - 4; this.ta = 0;
    }
    this.muf = el('g', { 'data-comp': 'muffler' }, gg);
    this.plume = new ExhaustPlume(gg, 60);
    const pg = el('g', { 'pointer-events': 'none' }, gg);
    this.pulses = xs.map(() => el('circle', { r: 0, fill: '#fff2c4', filter: 'url(#glow)' }, pg));
    this.kind = null;
  }

  update(st, P, dt) {
    const E = this.E;
    if (this.kind !== mufKey(P)) { this.kind = mufKey(P); this.tail = drawMuffler(this.muf, P, 1230, 742, false, 1.15).tail; }
    this.name.textContent = P.muffler === false ? 'sem silencioso (tubo direto)' : P.baffle > 0.75 ? 'silencioso original' : P.baffle > 0.3 ? 'escape esportivo' : 'escape quase direto';
    const col = tempColor(st.temp.egt, 20, 1000);
    this.core.forEach((c) => c.setAttribute('stroke', col));
    const run = st.running && !st.broken;
    const off = E.firing[P.crank] || Object.values(E.firing)[0];
    for (let i = 0; i < this.n; i++) {
      let u;
      if (E.rotary) u = ((((st.vis.long - off[i] - 40) % 360) + 360) % 360) / 240;
      else { const th = localAngle(st, P, E, i), evo = E.valve.exh.evo; u = ((th - evo + 720) % 720) / 226; }
      const c = this.pulses[i];
      if (u <= 1 && st.rpm > 30) {
        const L = this.meas[i].getTotalLength(), pt = this.meas[i].getPointAtLength(u * L);
        const strong = run && st.comb > 0 && !st.cut.any && (i + 1) !== P.failSpark;
        attr(c, { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: ((strong ? 6 + 3 * Math.min(1.5, st.map) : 3.5) * (1 - 0.4 * u)).toFixed(1), 'fill-opacity': strong ? 0.95 : 0.4 });
      } else c.setAttribute('r', 0);
    }
    if (this.tw) {
      this.ta = (this.ta + st.spool * 1300 * dt) % 360;
      this.tw.setAttribute('transform', `rotate(${this.ta.toFixed(1)} ${this.tx} ${this.ty})`);
    }
    this.plume.setTails([{ x: this.tail, y: 742 }]);
    this.plume.update(st, P, dt);
  }
}

export { fmt };
