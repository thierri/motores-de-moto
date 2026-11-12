// Painel de instrumentos: painel TFT (giro, marcha, velocidade), números do motor, dinamômetro,
// pressão no cilindro ao longo do ciclo e luzes de aviso.
import { el, txt, attr, fmt, fmtInt, gasColor } from './svg.js';
import { wotCurve, cv, cylPressure, localAngle } from '../sim/engine.js';
import { profile, modeName } from '../config.js';

const LIGHTS = [
  ['key', 'Ignição', 'g'],
  ['neutral', 'Neutro', 'g'],
  ['limit', 'Corte de giro', 'r'],
  ['knock', 'Detonação', 'y'],
  ['temp', 'Temperatura', 'r'],
  ['oil', 'Pressão do óleo', 'r'],
  ['float', 'Sobregiro', 'r'],
  ['dtc', 'Controle de tração', 'y'],
  ['fan', 'Ventoinha', 'g'],
  ['broken', 'Motor danificado', 'r'],
];

// carros: sem empinada nem corta-corrente; entram o nível da água e o ar-condicionado
const LIGHTS_CAR = [
  ['key', 'Ignição', 'g'],
  ['neutral', 'Ponto morto', 'g'],
  ['limit', 'Corte de giro', 'r'],
  ['knock', 'Detonação', 'y'],
  ['temp', 'Superaquecendo', 'r'],
  ['oil', 'Pressão do óleo', 'r'],
  ['float', 'Sobregiro', 'r'],
  ['dtc', 'Controle de tração', 'y'],
  ['fan', 'Ventoinha', 'g'],
  ['water', 'Nível da água', 'r'],
  ['ac', 'Ar-condicionado', 'g'],
  ['broken', 'Motor danificado', 'r'],
];
const lightsHtml = (L) => L.map(([k, n, c]) => `<div class="lt ${c}" data-k="${k}"><i></i>${n}</div>`).join('');

export class Panel {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <section class="card tft" data-spot="tft">
        <svg id="tft" viewBox="0 0 496 178"></svg>
      </section>
      <section class="card nums" data-spot="nums">
        <div><label>Potência</label><b id="vKw">0</b><i>cv</i></div>
        <div><label>Torque</label><b id="vT">0</b><i>Nm</i></div>
        <div><label>Coletor</label><b id="vMap">101</b><i>kPa</i></div>
        <div><label>Borboleta</label><b id="vTps">0</b><i>%</i></div>
        <div><label>Mistura λ</label><b id="vLam">1,00</b><i></i></div>
        <div><label>Avanço</label><b id="vAdv">0</b><i>°</i></div>
        <div><label>Escape</label><b id="vEgt">25</b><i>°C</i></div>
        <div><label>Óleo</label><b id="vOil">0,0</b><i>bar</i></div>
      </section>
      <section class="card chart" data-spot="dyno">
        <div class="hd"><span>Dinamômetro · plena carga</span><b id="dynoPk"></b></div>
        <svg id="dyno" viewBox="0 0 496 170"></svg>
      </section>
      <section class="card chart" data-spot="pcyl">
        <div class="hd"><span id="pcylT">Pressão no cilindro 1</span><b id="pcylV"></b></div>
        <svg id="pcyl" viewBox="0 0 496 112"></svg>
      </section>
      <section class="card lights" data-spot="lights">
        ${lightsHtml(LIGHTS)}
      </section>`;
    const $ = (s) => root.querySelector(s);
    this.e = { kw: $('#vKw'), T: $('#vT'), map: $('#vMap'), tps: $('#vTps'), lam: $('#vLam'), adv: $('#vAdv'), egt: $('#vEgt'), oil: $('#vOil'), pk: $('#dynoPk'), pcT: $('#pcylT'), pcV: $('#pcylV') };
    this.lightsBox = $('.lights');
    this.car = false;
    this.bindLights();
    this.tftSvg = $('#tft');
    this.dynoSvg = $('#dyno');
    this.engine = null;
    this.buildPcyl($('#pcyl'));
    this.cyl = 0;
    this.resetFx();
  }

  bindLights() {
    this.lights = {};
    this.lightsBox.querySelectorAll('.lt').forEach((l) => (this.lights[l.dataset.k] = l));
  }

  // ---------- painel de carro: conta-giros, velocímetro, temperatura da água e turbo (ou óleo) ----------
  buildCar(svg, E) {
    svg.innerHTML = '';
    const a = this.an = { vs: 0, vr: 0, vt: 40, vb: 0 };
    const defs = el('defs', {}, svg);
    const chrome = el('linearGradient', { id: 'chrome', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#4a4f57'], ['1', '#191c20']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, chrome));
    const face = el('radialGradient', { id: 'face', cx: '50%', cy: '40%', r: '65%' }, defs);
    [['0', '#23272d'], ['1', '#07080a']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, face));
    el('rect', { x: 0, y: 0, width: 496, height: 178, rx: 10, fill: '#0a0b0d' }, svg);
    // mostrador: escala de min a max entre os ângulos a0 e a1 (0° = para cima)
    const dial = (o) => {
      const { cx, cy, R, min = 0, max, step, big, a0 = -135, a1 = 135, red, fs = 10.5, fmtN = (v) => `${v}`, full = true } = o;
      const ang = (v) => (a0 + (a1 - a0) * Math.max(0, Math.min(1, (v - min) / (max - min)))) * Math.PI / 180;
      const pt = (v, r) => ({ x: cx + r * Math.sin(ang(v)), y: cy - r * Math.cos(ang(v)) });
      if (full) { el('circle', { cx, cy, r: R + 5, fill: 'url(#chrome)' }, svg); el('circle', { cx, cy, r: R, fill: 'url(#face)', stroke: '#000', 'stroke-width': 1.5 }, svg); }
      else { const A = pt(min, R), B = pt(max, R); el('path', { d: `M${A.x} ${A.y} A${R} ${R} 0 0 1 ${B.x} ${B.y}`, stroke: '#3a4048', 'stroke-width': 2, fill: 'none' }, svg); }
      if (red) {
        const A = pt(red[0], R - 6), B = pt(red[1], R - 6);
        el('path', { d: `M${A.x} ${A.y} A${R - 6} ${R - 6} 0 0 1 ${B.x} ${B.y}`, stroke: '#d8262b', 'stroke-width': 5, fill: 'none' }, svg);
      }
      for (let v = min; v <= max + 1e-6; v += step) {
        const isBig = Math.abs((v - min) / big - Math.round((v - min) / big)) < 1e-6;
        const p0 = pt(v, R - (isBig ? 12 : 7)), p1 = pt(v, R - 3);
        el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, stroke: '#f2f2f2', 'stroke-width': isBig ? 2 : 1 }, svg);
        if (isBig) { const q = pt(v, R - (full ? 24 : 21)); txt(svg, q.x, q.y + 4, fmtN(v), { 'font-size': fs, 'font-weight': 700, fill: '#f2f2f2', 'text-anchor': 'middle' }); }
      }
      const needle = el('g', {}, svg);
      el('path', { d: `M${cx - 2.2} ${cy + (full ? 13 : 4)} L${cx - 1} ${cy - R + 10} L${cx + 1} ${cy - R + 10} L${cx + 2.2} ${cy + (full ? 13 : 4)} Z`, fill: '#ff5a1f' }, needle);
      el('circle', { cx, cy, r: full ? 6.5 : 4.5, fill: 'url(#chrome)', stroke: '#222' }, svg);
      return { cx, cy, min, max, a0, a1, needle };
    };
    const tm = Math.round(E.rpmMax / 1000), sm = E.speedMax || 280;
    a.tc = dial({ cx: 104, cy: 92, R: 76, max: tm, step: 0.5, big: 1, red: [E.limit / 1000, tm] });
    a.sp = dial({ cx: 392, cy: 92, R: 76, max: sm, step: 10, big: 40, fs: 9.5 });
    txt(svg, 104, 64, 'x1000 rpm', { 'font-size': 8.5, fill: '#9aa3ad', 'text-anchor': 'middle' });
    txt(svg, 392, 64, 'km/h', { 'font-size': 9.5, fill: '#9aa3ad', 'text-anchor': 'middle' });
    a.wt = dial({ cx: 248, cy: 70, R: 46, min: 40, max: 130, step: 15, big: 45, a0: -68, a1: 68, red: [110, 130], fs: 9, full: false });
    a.turbo = !!E.turbo;
    a.g2 = E.turbo
      ? dial({ cx: 248, cy: 152, R: 46, min: 0, max: 2, step: 0.25, big: 1, a0: -68, a1: 68, red: [1.5, 2], fs: 9, full: false })
      : dial({ cx: 248, cy: 152, R: 46, min: 40, max: 160, step: 20, big: 60, a0: -68, a1: 68, red: [135, 160], fs: 9, full: false });
    a.tempT = txt(svg, 248, 94, '', { 'font-size': 11.5, 'font-weight': 700, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    a.g2T = txt(svg, 248, 175, '', { 'font-size': 11.5, 'font-weight': 700, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    el('rect', { x: 84, y: 126, width: 40, height: 28, rx: 4, fill: '#120d05', stroke: '#3b2a10' }, svg);
    a.gear = txt(svg, 104, 147, 'N', { 'font-size': 22, 'font-weight': 800, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    el('rect', { x: 362, y: 128, width: 60, height: 22, rx: 4, fill: '#120d05', stroke: '#3b2a10' }, svg);
    a.odo = txt(svg, 392, 144, '', { 'font-size': 12, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    a.mode = txt(svg, 248, 14, '', { 'font-size': 10, 'font-weight': 700, fill: '#9aa3ad', 'text-anchor': 'middle' });
  }

  updateCar(st, P, dt, E) {
    const a = this.an, on = st.key;
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.09) : 1, ks = dt > 0 ? 1 - Math.exp(-dt / 0.5) : 1;
    if (on && !this.anWasOn) this.anSweep = 1.2;
    this.anWasOn = on;
    let ts = st.v * 3.6, tr = st.rpm / 1000;
    if (this.anSweep > 0) { this.anSweep -= dt; const u = this.anSweep > 0.6 ? 1 : this.anSweep / 0.6; ts = Math.max(ts, a.sp.max * u); tr = Math.max(tr, a.tc.max * u); }
    const g2v = a.turbo ? Math.max(0, st.boost) : st.temp.oil;
    a.vs += (ts - a.vs) * k; a.vr += (tr - a.vr) * k;
    a.vt += ((on ? st.temp.coolant : 40) - a.vt) * ks;
    a.vb += ((on ? g2v : a.g2.min) - a.vb) * (a.turbo ? k : ks);
    const rot = (d, v) => d.needle.setAttribute('transform', `rotate(${(d.a0 + (d.a1 - d.a0) * Math.max(0, Math.min(1.02, (v - d.min) / (d.max - d.min)))).toFixed(2)} ${d.cx} ${d.cy})`);
    rot(a.sp, a.vs); rot(a.tc, a.vr); rot(a.wt, a.vt); rot(a.g2, a.vb);
    a.gear.textContent = on ? (st.gear === 0 ? 'N' : String(st.gear)) : '';
    a.odo.textContent = on ? `${fmt(st.dist / 1000, 1)} km` : '';
    const hot = st.temp.coolant > E.hot, blink = Math.floor(st.t * 4) % 2 === 0;
    a.tempT.textContent = on ? `água ${Math.round(st.temp.coolant)}°` : '';
    a.tempT.setAttribute('fill', hot ? (blink ? '#ff4d4d' : '#7a2020') : st.temp.coolant < 60 ? '#7fb6ff' : '#ffb347');
    a.g2T.textContent = !on ? '' : a.turbo ? `turbo ${fmt(Math.max(0, st.boost), 2)} bar` : `óleo ${Math.round(st.temp.oil)}°`;
    a.mode.textContent = on ? `${(modeName(P) || '').toUpperCase()}${st.ac ? ' · A/C' : ''}` : '';
  }

  // ---------- painel TFT ----------
  buildTft(svg, E) {
    svg.innerHTML = '';
    const RMAX = E.rpmMax;
    const t = this.t = {};
    el('rect', { x: 0, y: 0, width: 496, height: 178, rx: 10, fill: '#05080c' }, svg);
    // luzes de troca
    t.shift = [0, 1, 2, 3, 4].map((k) => el('circle', { cx: 188 + k * 30, cy: 16, r: 8, fill: '#1a2026', stroke: '#2a333d', 'stroke-width': 1 }, svg));
    // barra de giro em segmentos
    t.segs = [];
    const x0 = 16, x1 = 480, y = 36, n = 80;
    for (let k = 0; k < n; k++) {
      const r = (k + 0.5) / n * RMAX;
      const x = x0 + (k / n) * (x1 - x0);
      const h = 14 + 22 * Math.pow(k / n, 1.6);
      t.segs.push({ r, e: el('rect', { x: x.toFixed(1), y: (y + 40 - h).toFixed(1), width: ((x1 - x0) / n - 1.6).toFixed(1), height: h.toFixed(1), rx: 1 }, svg) });
    }
    const stepK = RMAX > 10000 ? 2 : 1;
    for (let r = 0; r <= RMAX / 1000; r += stepK) {
      const x = x0 + (r * 1000 / RMAX) * (x1 - x0);
      txt(svg, x, y + 56, `${r}`, { 'font-size': 12, fill: '#6f8297', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    }
    t.redline = el('rect', { y: y - 2, height: 44, width: 2, fill: '#ff4d4d' }, svg);
    t.rpm = txt(svg, 20, 150, '0', { 'font-size': 46, 'font-weight': 700, fill: '#fff', 'font-family': 'var(--mono)' });
    txt(svg, 22, 168, 'rpm', { 'font-size': 12, fill: '#6f8297' });
    t.gear = txt(svg, 262, 160, 'N', { 'font-size': 76, 'font-weight': 800, fill: '#3ecf72', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    t.speed = txt(svg, 476, 140, '0', { 'font-size': 40, 'font-weight': 700, fill: '#fff', 'text-anchor': 'end', 'font-family': 'var(--mono)' });
    txt(svg, 476, 158, 'km/h', { 'font-size': 12, fill: '#6f8297', 'text-anchor': 'end' });
    t.mode = txt(svg, 476, 112, '', { 'font-size': 13, 'font-weight': 700, fill: '#4fa3ff', 'text-anchor': 'end' });
    t.temp = txt(svg, 340, 112, '', { 'font-size': 13, fill: '#aebdcc', 'font-family': 'var(--mono)', 'text-anchor': 'middle' });
    t.qs = txt(svg, 340, 168, '', { 'font-size': 11.5, fill: '#6f8297', 'text-anchor': 'middle' });
    t.msg = txt(svg, 248, 16, '', { 'font-size': 12, fill: '#f2b632', 'text-anchor': 'middle' });
  }

  // ---------- painel analógico (estilo Harley): velocímetro grande, conta-giros, visor e luzes-espia ----------
  buildAnalog(svg, E) {
    svg.innerHTML = '';
    const a = this.an = { vs: 0, vr: 0 };
    const defs = el('defs', {}, svg);
    const chrome = el('linearGradient', { id: 'chrome', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const classic = E.cluster === 'classic';
    (classic ? [['0', '#3a3d42'], ['1', '#15171a']] : [['0', '#f4f7fa'], ['0.45', '#8d96a1'], ['0.55', '#5d6670'], ['1', '#dfe5ea']]).forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, chrome));
    const face = el('radialGradient', { id: 'face', cx: '50%', cy: '40%', r: '65%' }, defs);
    [['0', '#23272d'], ['1', '#07080a']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, face));
    el('rect', { x: 0, y: 0, width: 496, height: 178, rx: 10, fill: '#0a0b0d' }, svg);
    el('path', { d: 'M40 160 Q248 186 456 160', stroke: '#2a2f36', 'stroke-width': 1, fill: 'none' }, svg);

    // ângulo: 0° no topo, sentido horário; escala de −135° a +135°
    const dial = (cx, cy, R, max, step, big, fmtN, red) => {
      el('circle', { cx, cy, r: R + 6, fill: 'url(#chrome)' }, svg);
      el('circle', { cx, cy, r: R, fill: 'url(#face)', stroke: '#000', 'stroke-width': 1.5 }, svg);
      const ang = (v) => (-135 + 270 * Math.max(0, Math.min(1, v / max))) * Math.PI / 180;
      const pt = (v, r) => ({ x: cx + r * Math.sin(ang(v)), y: cy - r * Math.cos(ang(v)) });
      if (red != null) {
        const A = pt(red, R - 7), B = pt(max, R - 7);
        el('path', { d: `M${A.x} ${A.y} A${R - 7} ${R - 7} 0 0 1 ${B.x} ${B.y}`, stroke: '#d8262b', 'stroke-width': 6, fill: 'none' }, svg);
      }
      for (let v = 0; v <= max + 1e-6; v += step) {
        const isBig = Math.abs(v / big - Math.round(v / big)) < 1e-6;
        const p0 = pt(v, R - (isBig ? 13 : 8)), p1 = pt(v, R - 3);
        el('line', { x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, stroke: '#f2f2f2', 'stroke-width': isBig ? 2 : 1 }, svg);
        if (isBig) {
          const q = pt(v, R - 25);
          txt(svg, q.x, q.y + 4, fmtN(v), { 'font-size': R > 70 ? 10.5 : 11, 'font-weight': 700, fill: '#f2f2f2', 'text-anchor': 'middle' });
        }
      }
      const needle = el('g', {}, svg);
      el('path', { d: `M${cx - 2.5} ${cy + 14} L${cx - 1.2} ${cy - R + 12} L${cx + 1.2} ${cy - R + 12} L${cx + 2.5} ${cy + 14} Z`, fill: '#ff5a1f' }, needle);
      return { cx, cy, R, needle, max };
    };
    const sm = E.speedMax || 220, tm = Math.round(E.rpmMax / 1000);
    a.sp = dial(150, 92, 80, sm, sm > 150 ? 10 : 5, sm > 150 ? 20 : 10, (v) => `${v}`, null);
    a.tc = dial(372, 96, 62, tm, tm > 8 ? 1 : 0.5, tm > 8 ? 2 : 1, (v) => `${v}`, E.limit / 1000);
    txt(svg, 150, 62, 'km/h', { 'font-size': 10, fill: '#9aa3ad', 'text-anchor': 'middle' });
    txt(svg, 372, 74, 'x1000 rpm', { 'font-size': 9, fill: '#9aa3ad', 'text-anchor': 'middle' });
    // visores digitais (âmbar)
    el('rect', { x: 122, y: 130, width: 56, height: 28, rx: 4, fill: '#120d05', stroke: '#3b2a10' }, svg);
    a.gear = txt(svg, 136, 151, 'N', { 'font-size': 22, 'font-weight': 800, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    a.odo = txt(svg, 175, 143, '', { 'font-size': 10, fill: '#ffb347', 'text-anchor': 'end', 'font-family': 'var(--mono)' });
    a.odo2 = txt(svg, 175, 154, '', { 'font-size': 8.5, fill: '#c98a33', 'text-anchor': 'end', 'font-family': 'var(--mono)' });
    a.temp = txt(svg, 372, 175, '', { 'font-size': 10, fill: '#ffb347', 'text-anchor': 'middle', 'font-family': 'var(--mono)' });
    for (const d of [a.sp, a.tc]) { el('circle', { cx: d.cx, cy: d.cy, r: 7, fill: 'url(#chrome)', stroke: '#222' }, svg); d.needle.parentNode.appendChild(d.needle); el('circle', { cx: d.cx, cy: d.cy, r: 6, fill: 'url(#chrome)', stroke: '#222' }, svg); }
    // luzes-espia
    a.lamps = [['N', '#2fd36b', 'neutral'], ['OIL', '#ff3b30', 'oil'], ['ENG', '#ffb000', 'eng'], ['TC', '#ffb000', 'tc'], ['TEMP', '#ff3b30', 'temp']].map(([t, c, k], i) => {
      const x = 262, y = 20 + i * 28;
      const lamp = el('circle', { cx: x, cy: y, r: 11, fill: '#15181c', stroke: '#2a2f36' }, svg);
      const tt = txt(svg, x, y + 3.2, t, { 'font-size': t.length > 2 ? 7.5 : 10, 'font-weight': 800, fill: '#3a3f46', 'text-anchor': 'middle' });
      return { k, c, lamp, tt };
    });
    a.mode = txt(svg, 262, 172, '', { 'font-size': 10, 'font-weight': 700, fill: '#9aa3ad', 'text-anchor': 'middle' });
  }

  updateAnalog(st, P, dt, E) {
    const a = this.an, on = st.key;
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.09) : 1;
    // ponteiros: varrem até o fim e voltam ao ligar a chave (autoteste)
    if (on && !this.anWasOn) this.anSweep = 1.2;
    this.anWasOn = on;
    let ts = st.v * 3.6, tr = st.rpm / 1000;
    if (this.anSweep > 0) { this.anSweep -= dt; const u = this.anSweep > 0.6 ? 1 : this.anSweep / 0.6; ts = Math.max(ts, a.sp.max * u); tr = Math.max(tr, a.tc.max * u); }
    a.vs += (ts - a.vs) * k; a.vr += (tr - a.vr) * k;
    const rot = (d, v) => d.needle.setAttribute('transform', `rotate(${(-135 + 270 * Math.max(0, Math.min(1.02, v / d.max))).toFixed(2)} ${d.cx} ${d.cy})`);
    rot(a.sp, a.vs); rot(a.tc, a.vr);
    a.gear.textContent = on ? (st.gear === 0 ? 'N' : String(st.gear)) : '';
    a.odo.textContent = on ? `${fmt(st.dist / 1000, 1)}` : '';
    a.odo2.textContent = on ? 'km' : '';
    a.temp.textContent = on ? `${E.tempName} ${Math.round(st.temp.coolant)}°` : '';
    a.mode.textContent = on ? (modeName(P) || '').toUpperCase() : '';
    const L = { neutral: on && st.gear === 0, oil: on && st.oilP < 0.4 && !st.broken, eng: on && (st.knock > 0.03 || !!st.broken || st.float > 0), tc: on && st.dtcOn && P.dtc, temp: on && st.temp.coolant > E.hot };
    if (this.anSweep > 0) for (const x in L) L[x] = on;
    for (const l of a.lamps) {
      l.lamp.setAttribute('fill', L[l.k] ? l.c : '#15181c');
      l.tt.setAttribute('fill', L[l.k] ? '#0a0b0d' : '#3a3f46');
    }
  }

  // ---------- dinamômetro ----------
  buildDyno(svg, E) {
    svg.innerHTML = '';
    const RMAX = E.rpmMax;
    const d = this.d = { x0: 40, x1: 456, y0: 146, y1: 10, kwTop: E.dyno.cv, tTop: E.dyno.nm, RMAX };
    d.gx = (r) => d.x0 + (r / RMAX) * (d.x1 - d.x0);
    d.gp = (c) => d.y0 - (c / d.kwTop) * (d.y0 - d.y1);
    d.gt = (t) => d.y0 - (t / d.tTop) * (d.y0 - d.y1);
    for (let c = 0; c <= d.kwTop; c += d.kwTop / 4) {
      el('line', { x1: d.x0, y1: d.gp(c), x2: d.x1, y2: d.gp(c), stroke: '#fff', 'stroke-opacity': 0.06 }, svg);
      txt(svg, d.x0 - 6, d.gp(c) + 4, `${c}`, { 'font-size': 11, fill: '#f08a2c', 'text-anchor': 'end' });
      txt(svg, d.x1 + 6, d.gp(c) + 4, `${Math.round(c / d.kwTop * d.tTop)}`, { 'font-size': 11, fill: '#4fa3ff' });
    }
    for (let r = 0; r <= RMAX / 1000; r += RMAX > 12000 ? 2 : 1) {
      el('line', { x1: d.gx(r * 1000), y1: d.y0, x2: d.gx(r * 1000), y2: d.y1, stroke: '#fff', 'stroke-opacity': 0.05 }, svg);
      txt(svg, d.gx(r * 1000), d.y0 + 15, `${r}k`, { 'font-size': 11, fill: '#8da0b6', 'text-anchor': 'middle' });
    }
    txt(svg, d.x0 + 6, d.y1 + 12, 'cv', { 'font-size': 11, fill: '#f08a2c', 'font-weight': 700 });
    txt(svg, d.x1 - 6, d.y1 + 12, 'Nm', { 'font-size': 11, fill: '#4fa3ff', 'text-anchor': 'end', 'font-weight': 700 });
    d.ref = el('polyline', { fill: 'none', stroke: '#8da0b6', 'stroke-width': 1, 'stroke-dasharray': '3 4', 'stroke-opacity': 0.55 }, svg);
    d.kw = el('polyline', { fill: 'none', stroke: '#f08a2c', 'stroke-width': 2.4 }, svg);
    d.T = el('polyline', { fill: 'none', stroke: '#4fa3ff', 'stroke-width': 2 }, svg);
    d.lim = el('line', { y1: d.y0, y2: d.y1, stroke: '#ff4d4d', 'stroke-width': 1, 'stroke-dasharray': '2 3' }, svg);
    d.vline = el('line', { y1: d.y0, y2: d.y1, stroke: '#fff', 'stroke-width': 1, 'stroke-opacity': 0.4 }, svg);
    d.dot = el('circle', { r: 6, fill: '#f08a2c', stroke: '#fff', 'stroke-width': 2 }, svg);
    d.dotT = el('circle', { r: 4.5, fill: '#4fa3ff', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    d.key = null;
  }

  drawDyno(P) {
    const d = this.d;
    const E = profile(P);
    const c = wotCurve(P, Math.min(E.rpmMax, P.limit));
    const pk = c.reduce((a, b) => (b.kw > a.kw ? b : a), c[0]);
    const tk = c.reduce((a, b) => (b.T > a.T ? b : a), c[0]);
    d.kw.setAttribute('points', c.map((p) => `${d.gx(p.rpm).toFixed(1)},${d.gp(Math.max(0, cv(p.kw))).toFixed(1)}`).join(' '));
    d.T.setAttribute('points', c.map((p) => `${d.gx(p.rpm).toFixed(1)},${d.gt(Math.max(0, p.T)).toFixed(1)}`).join(' '));
    if (!this.refPts) {
      const ref = wotCurve({ ...P, exhaust: 'stock', muffler: true, baffle: 1, pipeLen: 1, mode: 'road', cr: E.cr, advance: 0, fuel: 1, shiftCam: E.shiftCam ? 'auto' : 'full', failSpark: 0, failFilter: false, limit: E.limit, boost: E.turbo ? E.turbo.boost : 0, port: 'stock', failApex: false }, E.limit);
      this.refPts = ref.map((p) => `${d.gx(p.rpm).toFixed(1)},${d.gp(Math.max(0, cv(p.kw))).toFixed(1)}`).join(' ');
      d.ref.setAttribute('points', this.refPts);
    }
    attr(d.lim, { x1: d.gx(P.limit), x2: d.gx(P.limit) });
    this.e.pk.textContent = `${Math.round(cv(pk.kw))} cv a ${fmtInt(pk.rpm)} · ${Math.round(tk.T)} Nm a ${fmtInt(tk.rpm)}`;
  }

  // ---------- pressão no cilindro ----------
  buildPcyl(svg) {
    const c = this.c = { x0: 40, x1: 488, y0: 92, y1: 8 };
    c.gx = (a) => c.x0 + (a / 720) * (c.x1 - c.x0);
    c.gy = (p) => c.y0 - (Math.log10(Math.max(0.2, p)) - Math.log10(0.2)) / (Math.log10(120) - Math.log10(0.2)) * (c.y0 - c.y1);
    const names = ['Admissão', 'Compressão', 'Explosão', 'Escape'];
    const cols = ['#3d7fe0', '#2bb39a', '#f08a2c', '#8b7d70'];
    for (let k = 0; k < 4; k++) {
      el('rect', { x: c.gx(k * 180), y: c.y0 + 2, width: c.gx(180) - c.x0 - 1, height: 5, fill: cols[k] }, svg);
      txt(svg, c.gx(k * 180 + 90), c.y0 + 18, names[k], { 'font-size': 11, fill: '#8da0b6', 'text-anchor': 'middle' });
    }
    for (const p of [1, 10, 100]) {
      el('line', { x1: c.x0, y1: c.gy(p), x2: c.x1, y2: c.gy(p), stroke: '#fff', 'stroke-opacity': 0.06 }, svg);
      txt(svg, c.x0 - 6, c.gy(p) + 4, `${p}`, { 'font-size': 10.5, fill: '#8da0b6', 'text-anchor': 'end' });
    }
    txt(svg, c.x0 + 6, c.y1 + 10, 'bar', { 'font-size': 10, fill: '#8da0b6' });
    c.area = el('path', { fill: '#f08a2c', 'fill-opacity': 0.12 }, svg);
    c.line = el('polyline', { fill: 'none', stroke: '#f2b632', 'stroke-width': 2 }, svg);
    c.mk = el('line', { y1: c.y0, y2: c.y1, stroke: '#fff', 'stroke-width': 1.2 }, svg);
    c.dot = el('circle', { r: 5, stroke: '#fff', 'stroke-width': 1.5 }, svg);
    c.t = 0;
  }

  resetFx() { if (this.d) this.d.key = null; this.c.t = 0; this.smooth = { kw: 0, T: 0 }; }

  update(st, P, dt, cyl = 0) {
    const E = profile(P);
    if (this.engine !== P.engine) {
      this.engine = P.engine;
      this.analog = E.cluster !== 'tft';
      this.carCl = E.cluster === 'car';
      if (this.carCl) this.buildCar(this.tftSvg, E); else if (this.analog) this.buildAnalog(this.tftSvg, E); else this.buildTft(this.tftSvg, E);
      if (this.car !== !!E.car) {
        this.car = !!E.car;
        this.lightsBox.innerHTML = lightsHtml(this.car ? LIGHTS_CAR : LIGHTS);
        this.lightsBox.classList.toggle('six', this.car);
        this.bindLights();
      }
      this.tftSvg.parentNode.classList.toggle('analog', this.analog);
      this.buildDyno(this.dynoSvg, E);
      this.refPts = null;
    }
    const RMAX = E.rpmMax;
    const e = this.e, t = this.t;
    const k = dt > 0 ? 1 - Math.exp(-dt / 0.12) : 1;
    this.smooth.kw += (cv(st.kw) - this.smooth.kw) * k;
    this.smooth.T += (st.Tb - this.smooth.T) * k;
    e.kw.textContent = Math.round(this.smooth.kw);
    e.T.textContent = Math.round(this.smooth.T);
    e.map.textContent = Math.round(st.map * 101.3);
    e.tps.textContent = Math.round(st.tps * 100);
    e.lam.textContent = st.running ? fmt(st.lambda, 2) : '—';
    e.adv.textContent = st.running ? fmt(st.adv, 0) : '—';
    e.egt.textContent = Math.round(st.temp.egt);
    e.oil.textContent = fmt(st.oilP, 1);

    // painel: TFT (4 em linha) ou analógico (V-Twin)
    const on = st.key;
    const rpm = st.rpm;
    const blink = Math.floor(st.t * 12) % 2 === 0;
    if (this.carCl) this.updateCar(st, P, dt, E);
    else if (this.analog) this.updateAnalog(st, P, dt, E);
    else {
    const shiftAt = P.limit * 0.877;
    for (const s of t.segs) {
      const lit = on && s.r <= rpm;
      s.e.setAttribute('fill', lit ? (s.r > P.limit * 0.96 ? '#ff4d4d' : s.r > shiftAt ? '#f2b632' : '#e6edf3') : '#151b22');
    }
    attr(t.redline, { x: 16 + (P.limit / RMAX) * 464 - 1 });
    t.shift.forEach((c, i) => {
      const thr = shiftAt + i * P.limit * 0.02;
      const lit = on && rpm > thr;
      const col = rpm > P.limit * 0.983 ? (blink ? '#4fa3ff' : '#1a2026') : lit ? (i < 3 ? '#3ecf72' : i < 4 ? '#f2b632' : '#ff4d4d') : '#1a2026';
      c.setAttribute('fill', col);
    });
    t.rpm.textContent = on ? fmtInt(Math.round(rpm / 10) * 10) : '';
    t.gear.textContent = on ? (st.gear === 0 ? 'N' : String(st.gear)) : '';
    t.gear.setAttribute('fill', st.gear === 0 ? '#3ecf72' : '#ffffff');
    t.speed.textContent = on ? Math.round(st.v * 3.6) : '';
    t.mode.textContent = on ? (modeName(P) || '').toUpperCase() : '';
    t.temp.textContent = on ? `${E.tempName} ${Math.round(st.temp.coolant)} °C` : '';
    t.temp.setAttribute('fill', st.temp.coolant > E.hot ? '#ff4d4d' : st.temp.coolant < 60 ? '#4fa3ff' : '#aebdcc');
    t.qs.textContent = on ? `${P.qs ? 'QS ✓' : 'QS —'} · ${P.dtc ? 'DTC ✓' : 'DTC —'}` : '';
    t.msg.textContent = '';
    }

    // dinamômetro
    const key = JSON.stringify([P.engine, P.crank, P.muffler, P.baffle, P.pipeLen, P.mode, P.limit, P.cr, P.advance, P.fuel, P.shiftCam, P.failSpark, P.failFilter, P.boost, P.port, P.failApex]);
    if (key !== this.d.key) { this.drawDyno(P); this.d.key = key; }
    const d = this.d, x = d.gx(Math.min(RMAX, rpm));
    attr(d.vline, { x1: x, x2: x });
    const pw = Math.max(0, this.smooth.kw), tq = Math.max(0, this.smooth.T);
    attr(d.dot, { cx: x, cy: d.gp(pw) });
    attr(d.dotT, { cx: x, cy: d.gt(tq) });
    d.dot.style.opacity = rpm > 300 ? 1 : 0;
    d.dotT.style.opacity = rpm > 300 ? 1 : 0;

    // pressão no cilindro (recalcula a curva 6× por segundo)
    const c = this.c;
    c.t -= dt;
    const comb = st.running && !st.cut.any && st.comb > 0 && (cyl + 1) !== P.failSpark ? 1 : 0;
    const opt = { pr: st.map, adv: st.adv, cr: P.cr, lambda: st.lambda, comb, E };
    if (c.t <= 0 || this.cyl !== cyl) {
      c.t = 1 / 6;
      this.cyl = cyl;
      const pts = [];
      for (let a = 0; a <= 720; a += 4) pts.push(`${c.gx(a).toFixed(1)},${c.gy(cylPressure(a, opt)).toFixed(1)}`);
      c.line.setAttribute('points', pts.join(' '));
      c.area.setAttribute('d', `M${c.x0} ${c.y0} L${pts.join(' L')} L${c.x1} ${c.y0} Z`);
      e.pcT.textContent = E.rotary ? `Pressão numa câmara do ${E.cylNames[cyl]}` : `Pressão no cilindro ${E.cylNames[cyl]}`;
      let pk = 0;
      for (let a = 330; a < 420; a += 2) pk = Math.max(pk, cylPressure(a, opt));
      e.pcV.textContent = st.rpm > 30 ? `pico ${Math.round(pk)} bar` : '';
    }
    const local = localAngle(st, P, E, cyl);
    const p = cylPressure(local, opt);
    attr(c.mk, { x1: c.gx(local), x2: c.gx(local) });
    attr(c.dot, { cx: c.gx(local), cy: c.gy(p), fill: gasColor(p) });

    // luzes
    const L = {
      key: st.key,
      neutral: st.key && st.gear === 0,
      limit: st.cut.lim,
      knock: st.knock > 0.03,
      temp: st.temp.coolant > E.hot,
      oil: st.key && st.oilP < 0.4 && !st.broken,
      float: st.float > 0,
      dtc: st.dtcOn && P.dtc,
      fan: st.fan && st.key,
      water: st.key && st.coolLvl < 0.6,
      ac: st.key && st.ac,
      broken: !!st.broken,
    };
    for (const k2 in this.lights) this.lights[k2].classList.toggle('on', !!L[k2] && (k2 !== 'limit' || blink || true));
    const loose = this.car ? st.spin : st.wheelie;
    this.lights.dtc.classList.toggle('r', !P.dtc && loose);
    if (!P.dtc) this.lights.dtc.classList.toggle('on', loose);
    this.lights.dtc.lastChild.textContent = P.dtc ? 'Controle de tração' : this.car ? 'Patinando!' : 'Empinando!';
  }
}
