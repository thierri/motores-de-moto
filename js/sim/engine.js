// Física do motor (4 em linha ou V-Twin), do câmbio e da moto. Não sabe que existe SVG nem áudio.
// Modelo quase-estático: a pressão no coletor sai do equilíbrio de vazões (borboleta = cilindros),
// o torque sai da curva de plena carga × enchimento × eficiências, e o virabrequim integra J·dω/dt.
// Tudo o que muda de um motor para outro vem do perfil E = ENGINES[P.engine] (config.js).
import { ENGINES, MODES, profile, exhaustOpen } from '../config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const RPM = 60 / (2 * Math.PI);
const G = 9.81;

// ---------- curvas suaves (Hermite monotônica) ----------
const tangents = new Map();
function interp(c, x) {
  let m = tangents.get(c);
  if (!m) {
    const n = c.length, d = [];
    for (let i = 0; i < n - 1; i++) d.push((c[i + 1][1] - c[i][1]) / (c[i + 1][0] - c[i][0]));
    m = [d[0]];
    for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    tangents.set(c, m);
  }
  if (x <= c[0][0]) return c[0][1];
  const n = c.length;
  if (x >= c[n - 1][0]) return c[n - 1][1] + m[n - 1] * (x - c[n - 1][0]);
  let i = 0;
  while (x > c[i + 1][0]) i++;
  const h = c[i + 1][0] - c[i][0], t = (x - c[i][0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * c[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * c[i + 1][1] + (t3 - t2) * h * m[i + 1];
}

// ---------- perdas ----------
export const friction = (rpm, E) => (rpm < 1 ? 0 : E.fric[0] + E.fric[1] * rpm + E.fric[2] * rpm * rpm);
const pumping = (pr, E) => (1 - pr) * E.disp * 8.06;   // Nm: vácuo no coletor × cilindrada ÷ 4π
const WOT_PR = 0.975;

// Torque indicado a plena carga (borboleta toda aberta), por ressalto
function indWot(rpm, cam, E) {
  const full = interp(E.curveFull, rpm);
  const tb = !E.curvePart || cam >= 1 ? full : cam <= 0 ? interp(E.curvePart, rpm) : interp(E.curvePart, rpm) * (1 - cam) + full * cam;
  return tb + friction(rpm, E) + pumping(WOT_PR, E);
}
function ref(E) {
  if (!E._ref) {
    const pk = E.curveFull.reduce((a, b) => (b[1] > a[1] ? b : a));
    E._ref = indWot(pk[0], 1, E);
  }
  return E._ref;
}
// eficiência volumétrica relativa (para a vazão de ar)
const ve = (rpm, cam, E) => indWot(rpm, cam, E) / ref(E) * 1.08;

// ---------- eficiências ----------
export function etaLambda(l) {
  const d = l - 0.88;
  return clamp(1 - (d < 0 ? 2.4 : 2.0) * d * d, 0.4, 1);
}
export const etaAdvance = (d) => clamp(1 - 0.0022 * d * d, 0.3, 1);
export const etaCr = (cr, E) => (1 - Math.pow(cr, -0.3)) / (1 - Math.pow(E.cr, -0.3));
const bump = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
// Escapamento: um silencioso mais aberto rende mais em cima e perde no meio (sem contrapressão);
// tubos mais longos afinam o pulso para giros mais baixos (ganha no meio, perde em cima).
export function etaExhaust(P, rpm, E) {
  const r = rpm / E.limit;  // posição relativa na faixa de giro
  const o = exhaustOpen(P), L = (P.pipeLen ?? 1) - 1;
  return 1 + 0.035 * o * bump(r, 0.9, 0.15) - 0.07 * o * o * bump(r, 0.48, 0.12) - 0.015 * (1 - o) * bump(r, 0.97, 0.1)
    + 0.06 * L * bump(r, 0.45, 0.16) - 0.06 * L * bump(r, 0.93, 0.12);
}

// ---------- ar: borboleta × cilindros ----------
const psi = (pr) => (pr <= 0.528 ? 1 : Math.sqrt(Math.max(0, 1 - ((pr - 0.528) / 0.472) ** 2)));
export const throttleArea = (tps) => 1 - Math.cos(clamp(tps, 0, 1) * Math.PI / 2);
const qEngine = (rpm, cam, E) => ve(rpm, cam, E) * E.disp * Math.max(rpm, 30) / (0.999 * 14000);

// Pressão relativa no coletor (MAP / atmosfera) que equilibra a vazão da borboleta com a dos cilindros
export function solvePr(area, rpm, cam, filter, E) {
  const qe = qEngine(rpm, cam, E);
  const c = E.thr * (filter ? 0.3 : 1) * area;
  let lo = 0.02, hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (c * psi(m) > qe * m) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
// abertura da válvula de ar da marcha lenta que segura ~26 kPa no coletor
function idleBase(E) {
  if (!E._idleA) E._idleA = qEngine(E.idle, E.shiftCam ? 0 : 1, E) * 0.26 / E.thr;
  return E._idleA;
}

// ---------- ignição e mistura ----------
export const advanceMap = (rpm, pr, E) => clamp(E.adv.a + E.adv.b * (rpm / E.adv.rpm), E.adv.a, E.adv.max) - 8 * pr;
export const lambdaTarget = (tps, rpm, E) => (tps > 0.7 || (tps > 0.45 && rpm > E.lamRpm) ? 0.88 : 1.0);

// ---------- geometria do cilindro ----------
// distância do pistão ao PMS (mm) para um ângulo do virabrequim (graus)
export function pistonDrop(deg, E) {
  const R = E.stroke / 2, L = E.rod;
  const a = deg * Math.PI / 180, s = R * Math.sin(a);
  return R + L - (R * Math.cos(a) + Math.sqrt(L * L - s * s));
}
export function cylVolume(deg, cr, E) {
  const vs = E.disp / E.cyl;
  return vs / (cr - 1) + vs * pistonDrop(deg, E) / E.stroke;
}

// Levante da válvula (0–1 do máximo) num ângulo do ciclo local (0–720°)
function liftShape(th, open, close) {
  let x = th;
  while (x < open) x += 720;
  while (x >= open + 720) x -= 720;
  if (x > close) return 0;
  const u = (x - open) / (close - open);
  const s = Math.sin(Math.PI * u);
  return s * s;
}
export function intakeLift(th, cam, E) {
  const V = E.valve;
  const f = liftShape(th, V.full.ivo, V.full.ivc);
  if (!V.part) return f;
  const p = liftShape(th, V.part.ivo, V.part.ivc) * V.part.lift / V.full.lift;
  return p * (1 - cam) + f * cam;
}
export const exhaustLift = (th, E) => liftShape(th, E.valve.exh.evo, E.valve.exh.evc);

// Pressão no cilindro (bar) num ângulo do ciclo local. comb: 0 (sem combustão) a 1.
export function cylPressure(th, o) {
  const { pr, comb, adv, cr, lambda = 0.9, E } = o;
  th = ((th % 720) + 720) % 720;
  const map = pr * 1.013;
  const ivc = E.valve.full.ivc - 11, evo = E.valve.exh.evo;
  if (th < ivc) return map;
  const v = cylVolume(th, cr, E), vIvc = cylVolume(ivc, cr, E);
  const pm = map * Math.pow(vIvc / v, 1.32);
  const ths = 360 - adv, dur = E.cyl === 2 ? 62 : 52;
  const gain = 2.5 * (E.cr / 13.3) ** 0.4;
  let xb = 0;
  if (th > ths) xb = 1 - Math.exp(-5 * Math.pow(Math.min(1, (th - ths) / dur), 3));
  const p = pm * (1 + gain * comb * etaLambda(lambda) * xb);
  if (th < evo) return p;
  const pe = cylVolume(evo, cr, E);
  const pEvo = map * Math.pow(vIvc / pe, 1.32) * (1 + gain * comb * etaLambda(lambda));
  const pexh = 1.12;
  if (th < 700) return pexh + (pEvo - pexh) * Math.exp(-(th - evo) / 14);
  return pexh + (map - pexh) * (th - 700) / 20;
}

export function strokeOf(th) {
  th = ((th % 720) + 720) % 720;
  return th < 180 ? 0 : th < 360 ? 1 : th < 540 ? 2 : 3; // admissão, compressão, explosão, escape
}

// ---------- estado ----------
export function createState(P, o = {}) {
  return {
    t: 0,
    input: { grip: 0, start: false, clutch: 0, brake: 0 },
    key: false, run: true, pumpT: 0, primed: false,
    omega: 0, rpm: 0, running: false, starter: false, broken: null, crankMsg: '',
    tps: 0, tpsReq: 0, idleA: 0.0045, idleI: 0, pr: 1, cam: 0, camFull: false,
    lambda: 1, adv: 0, retard: 0, knock: 0, knockT: 0, float: 0, overT: 0,
    cut: { lim: false, decel: false, qs: 0, any: false },
    blip: 0, blipTps: 0,
    Tind: 0, Tb: 0, Tc: 0, kw: 0, comb: 0,
    gear: 0, v: 0, dist: 0, locked: false, slip: 0, dtc: 1, dtcOn: false, wheelie: false, accel: 0,
    temp: { coolant: 35, oil: 33, egt: 25, amb: 25 }, fan: false, oilP: 0, fuelLh: 0,
    msg: '', msgT: 0,
    vis: { theta: 0, rpm: 0 },
    snd: { cutAcc: 0, tAcc: 0, shift: 0, clunk: 0, grind: 0 },
    ...o,
  };
}

function say(st, m, t = 3) { st.msg = m; st.msgT = t; }

export function gearRatio(g, E) { const B = E.gearbox; return g ? B.primary * B.ratios[g] * B.final : 0; }

// Troca de marcha. dir: +1 sobe, −1 desce, 0 = neutro (meio toque)
export function shift(st, P, dir) {
  if (st.broken) return;
  const E = profile(P);
  const g = st.gear;
  let ng;
  if (dir === 0) {
    if (g !== 1 && g !== 2) { say(st, 'O neutro fica entre a 1ª e a 2ª (padrão 1-N-2-3-4-5-6).'); return; }
    ng = 0;
  } else if (dir > 0) ng = g === 0 ? 2 : Math.min(6, g + 1);
  else ng = g === 0 ? 1 : g === 2 && st.v < 0.5 ? 1 : Math.max(1, g - 1);
  if (ng === g) return;
  const pulled = st.input.clutch > 0.6;
  const qsUp = P.qs && dir > 0 && g >= 1 && st.tps > 0.12 && st.running;
  const qsDown = P.qs && dir < 0 && g >= 2;
  if (!pulled && !qsUp && !qsDown && g !== 0 && ng !== 0) {
    st.snd.grind = 1;
    say(st, P.qs ? 'Sem embreagem, o quickshifter só sobe marcha com o acelerador aberto.' : 'Quickshifter desligado: puxe a embreagem (C) para trocar.');
    return;
  }
  if (ng > 0) {
    const w = (st.v / E.bike.r) * gearRatio(ng, E) * RPM;
    if (w > P.limit * 1.08) { say(st, `A ECU recusou a redução: o motor iria a ${Math.round(w / 100) * 100} rpm.`); return; }
  }
  if (g === 0 && ng > 0 && !pulled && st.v < 1 && st.rpm > 200) say(st, 'Engatou sem embreagem com a moto parada: o motor pode apagar. Use C.');
  st.gear = ng;
  st.locked = false;
  st.snd.shift = dir || 0.5;
  st.snd.clunk = 1;
  if (qsUp && !pulled) st.cut.qs = 0.055;
  if (qsDown && !pulled) { st.blip = 0.14; st.blipTps = 0.3; }
}

// ---------- passo da física ----------
export function step(st, P, dt) {
  st.t += dt;
  if (st.msgT > 0) st.msgT -= dt;
  const inp = st.input;
  const E = profile(P);
  const mode = MODES[P.mode] || MODES.road;
  const J = E.J * P.inertia;

  // bomba de combustível: escorva 2 s ao ligar a chave
  if (st.key && !st.wasKey) { st.pumpT = 2.0; st.primed = false; }
  st.wasKey = st.key;
  if (!st.key) { st.primed = false; st.pumpT = 0; }
  if (st.pumpT > 0) { st.pumpT -= dt; if (st.pumpT <= 0) st.primed = true; }
  const pumpOn = st.key && (st.pumpT > 0 || st.running);

  // motor de partida: só em neutro ou com embreagem puxada
  const canCrank = st.key && st.run && !st.broken;
  const allowStart = st.gear === 0 || inp.clutch > 0.6;
  st.starter = inp.start && canCrank && !st.running && allowStart;
  if (inp.start && canCrank && !st.running && !allowStart && st.msgT <= 0) say(st, 'Para dar partida engrenado, puxe a embreagem (C).');
  if (inp.start && canCrank && !st.running && allowStart && !st.primed && st.msgT <= 0) say(st, 'A bomba de combustível ainda está escorvando: segure a partida mais um pouco.', 1.5);

  // acelerador eletrônico
  const grip = clamp(inp.grip, 0, 1);
  let req = Math.pow(grip, mode.exp) * mode.max;
  if (st.blip > 0) { st.blip -= dt; req = Math.max(req, st.blipTps); }
  st.tpsReq = req;
  st.tps += (req - st.tps) * (1 - Math.exp(-dt / mode.tau));

  // marcha lenta (PI na válvula de ar) com marcha lenta acelerada a frio
  const cold = clamp((60 - st.temp.coolant) / 40, 0, 1);
  const idleT = P.idle * (1 + 0.36 * cold);
  const ib = idleBase(E), ik = ib / 0.0036, rs = E.idle / 1250;   // escala do controle para cada motor
  if (st.running && grip < 0.02) {
    const e = clamp((idleT - st.rpm) / (1000 * rs), -0.6, 0.6);
    // derivada da rotação amortece a oscilação (o coletor atrasa a resposta)
    const dr = (st.rpm - (st.rpmPrev ?? st.rpm)) / dt / (1000 * rs);
    if (st.rpm < idleT + 400 * rs) st.idleI = clamp(st.idleI + e * 0.0035 * ik * dt, -0.0025 * ik, 0.01 * ik);
    const cmd = clamp(ib + 0.0012 * ik * e - 0.00025 * ik * dr + st.idleI, 0.0012 * ik, 0.025 * ik);
    st.idleA += (cmd - st.idleA) * (1 - Math.exp(-dt / 0.04));
  } else if (!st.running) {
    st.idleA = ib * 1.9; st.idleI = 0.001 * ik;
  }
  st.rpmPrev = st.rpm;

  // comando variável (ShiftCam)
  if (!E.shiftCam || P.shiftCam === 'full') st.camFull = true;
  else if (P.shiftCam === 'part') st.camFull = false;
  else {
    if (!st.camFull && st.rpm > E.shiftCam && st.tps > 0.35) st.camFull = true;
    else if (st.camFull && (st.rpm < E.shiftCam - 300 || st.tps < 0.25)) st.camFull = false;
  }
  st.cam += ((st.camFull ? 1 : 0) - st.cam) * (1 - Math.exp(-dt / 0.06));

  // ar
  const area = throttleArea(st.tps) + st.idleA;
  const prT = solvePr(area, st.rpm, st.cam, P.failFilter, E);
  const tau = 2 / (st.rpm / 60 + 20);
  st.pr += (prT - st.pr) * (1 - Math.exp(-dt / tau));

  // cortes de combustível
  if (st.cut.qs > 0) st.cut.qs -= dt;
  if (st.rpm >= P.limit) st.cut.lim = true;
  else if (st.rpm < P.limit - 200 * (E.limit / 14600) ** 0.5) st.cut.lim = false;
  if (grip < 0.02 && st.blip <= 0 && st.rpm > idleT + 650 * rs && st.running) st.cut.decel = true;
  else if (st.rpm < idleT + 350 * rs || grip >= 0.02) st.cut.decel = false;
  st.cut.any = st.cut.lim || st.cut.decel || st.cut.qs > 0;

  // mistura e ignição
  st.lambda = lambdaTarget(st.tps, st.rpm, E) / P.fuel;
  st.advBase = advanceMap(st.rpm, st.pr, E);
  const advDelta = P.advance - st.retard;
  st.adv = st.advBase + advDelta;

  // combustão
  const fire = st.running && st.primed && st.key && st.run && !st.broken;
  let comb = fire ? 1 : 0;
  if (fire && P.failSpark) comb *= 1 - 1 / E.cyl;
  if (fire && st.lambda > 1.3) comb *= clamp(1 - (st.lambda - 1.3) * 3, 0, 1);
  if (st.cut.any) comb = 0;
  st.comb = comb;
  let softLim = 1;
  const sw = 250 * (E.limit / 14600) ** 0.5, sl0 = P.limit - sw;
  if (st.rpm > sl0) softLim = clamp(1 - 0.5 * (st.rpm - sl0) / sw, 0.5, 1);
  const fw = 1000 * E.limit / 14600;
  st.float = clamp((st.rpm - E.float) / fw, 0, 1);
  const eff = etaLambda(st.lambda) * etaAdvance(advDelta) * etaCr(P.cr, E) * etaExhaust(P, st.rpm, E);
  const fill = clamp((st.pr - 0.08) / (WOT_PR - 0.08), 0, 1);
  st.Tind = indWot(st.rpm, st.cam, E) * fill * eff * comb * softLim * (1 - 0.6 * st.float) * st.dtc;
  let loss = friction(st.rpm, E) + pumping(st.pr, E);
  if (st.broken) loss = loss * 6 + 25;
  const Tst = st.starter ? Math.max(0, E.starterT * (1 - st.rpm / E.crankRpm)) : 0;
  const Tnet = st.Tind - (st.omega > 0.5 ? loss : Math.min(loss, st.Tind + Tst)) + Tst;
  st.Tb = st.Tind - loss;

  // detonação
  const lean = Math.max(0, st.lambda - 0.9), rich = Math.max(0, 0.88 - st.lambda);
  const K = fill * fill * comb * (0.6 * (P.cr - E.cr) + 0.15 * advDelta + 4 * lean - 2 * rich
    + 0.03 * (st.temp.coolant - 100) + 0.55 * (1 - st.rpm / (0.82 * E.limit)));
  st.knock = clamp((K - 0.75) * 1.6, 0, 1);
  if (P.knockCtl) {
    if (st.knock > 0) st.retard = Math.min(14, st.retard + 30 * st.knock * dt);
    else st.retard = Math.max(0, st.retard - 1.5 * dt);
  } else st.retard = Math.max(0, st.retard - 5 * dt);
  st.knockT = st.knock > 0.45 && !P.knockCtl ? st.knockT + dt : Math.max(0, st.knockT - dt * 0.5);
  if (st.knockT > 5 && !st.broken) breakEngine(st, 'Detonação forte por tempo demais: o pistão furou.');
  st.overT = st.rpm > E.breakRpm ? st.overT + dt : 0;
  if (st.overT > 0.25 && !st.broken) breakEngine(st, 'Sobregiro: uma válvula flutuou e bateu no pistão.');

  // trem de força
  drivetrain(st, P, Tnet, J, dt, E);
  st.rpm = st.omega * RPM;

  // pega e apaga
  if (!st.running && fire === false && st.key && st.run && st.primed && !st.broken && st.rpm > 160) st.running = true;
  if (st.running && (st.rpm < 110 || !st.key || !st.run || st.broken)) {
    if (st.running && st.rpm < 110 && st.key && st.run && !st.broken && !st.starter) say(st, st.gear ? 'O motor apagou: soltou a embreagem com pouco giro.' : 'O motor apagou.');
    st.running = false;
  }

  // potência, consumo
  st.kw = st.Tb * st.omega / 1000;
  const pind = Math.max(0, st.Tind * st.omega);
  st.fuelLh = pind / 0.34 / 43e6 * 3600 / 0.745 * 1; // L/h
  thermal(st, P, pind, dt, E);
  st.oilP = st.rpm > 50 ? clamp((0.6 + 4.6 * Math.min(1, st.rpm / (0.48 * E.limit))) * (1.25 - 0.25 * clamp((st.temp.oil - 30) / 70, 0, 1)), 0, 6.5) : 0;
  st.pump = pumpOn;

  // som: fração do tempo com corte, desde a última leitura
  st.snd.tAcc += dt;
  if (st.cut.any || !fire) st.snd.cutAcc += dt;

  // ângulo visual (câmera lenta)
  const vrpm = P.anim === 'real' ? st.rpm : 40 * Math.pow(Math.max(0, st.rpm) / 1000, 0.7);
  st.vis.rpm = vrpm;
  st.vis.theta = (st.vis.theta + vrpm / 60 * 360 * dt) % 720;
}

function breakEngine(st, why) {
  st.broken = why;
  st.running = false;
  st.snd.bang = 1;
  say(st, why, 8);
}

function drivetrain(st, P, Tnet, J, dt, E) {
  const g = st.gear, inp = st.input;
  const BIKE = E.bike, GEARBOX = E.gearbox;
  const M = BIKE.m, r = BIKE.r;
  const brakeF = clamp(inp.brake, 0, 1) * 1.1 * M * G;
  const drag = 0.5 * BIKE.rho * BIKE.CdA * st.v * st.v + BIKE.crr * M * G;
  const Fres = st.v > 0.02 ? drag + brakeF : 0;
  const amax = (P.dtc ? 1.0 : 1.5) * G;
  st.slip = 0;
  if (!g) {
    st.omega = Math.max(0, st.omega + Tnet / J * dt);
    st.v = Math.max(0, st.v - Fres / M * dt);
    st.locked = false;
    st.Tc = 0;
  } else {
    const i = gearRatio(g, E), eta = GEARBOX.eff;
    const e = 1 - clamp(inp.clutch, 0, 1);
    const cap = GEARBOX.clutchMax * e * e * e;
    const Jv = M * r * r / (i * i * eta);
    const Text = Fres * r / (i * eta);
    const ww = st.v / r * i;
    let locked = st.locked && cap > 0.5;
    if (locked) {
      const a = (Tnet - Text) / (J + Jv);
      const Tc = Tnet - J * a;
      const capDir = Tc >= 0 ? cap : cap * GEARBOX.slipper;
      if (Math.abs(Tc) > capDir) locked = false;
      else {
        st.omega = Math.max(0, st.omega + a * dt);
        st.v = st.omega * r / i;
        st.Tc = Tc;
      }
    }
    if (!locked) {
      const d = st.omega - ww;
      const capDir = d >= 0 ? cap : cap * GEARBOX.slipper;
      const Tc = Math.abs(d) < 1e-6 ? 0 : Math.sign(d) * capDir;
      st.omega = Math.max(0, st.omega + (Tnet - Tc) / J * dt);
      const Fd = Tc * i * eta / r;
      st.v = Math.max(0, st.v + (Fd - Fres) / M * dt);
      st.Tc = Tc;
      const d2 = st.omega - st.v / r * i;
      st.slip = Math.abs(d2) * RPM;
      if (cap > 0.5 && (Math.sign(d2) !== Math.sign(d) || Math.abs(d2) < 0.3)) {
        const w = (J * st.omega + Jv * (st.v / r * i)) / (J + Jv);
        st.omega = w; st.v = w * r / i; locked = true; st.slip = 0;
      }
    }
    st.locked = locked;
  }
  // controle de tração / empinada: limita a aceleração
  const a = (st.v - (st.vPrev ?? st.v)) / dt;
  st.vPrev = st.v;
  st.accel += (a - st.accel) * (1 - Math.exp(-dt / 0.08));
  if (g && st.accel > amax) st.dtc = Math.max(0.15, st.dtc - 6 * dt);
  else st.dtc = Math.min(1, st.dtc + 2.5 * dt);
  st.dtcOn = st.dtc < 0.97;
  st.wheelie = g > 0 && st.accel > 1.05 * G;
  st.dist += st.v * dt;
}

function thermal(st, P, pind, dt, E) {
  const T = st.temp;
  // kW de calor para o arrefecimento; aquecimento acelerado para o simulador.
  // 4 em linha: água com válvula termostática e ventoinha. V-Twin: ar e óleo, depende do vento.
  const heat = pind / 0.34 * E.heat / 1000;
  let k;
  if (E.cyl === 2) {
    st.fan = false;
    k = 0.006 + 0.004 * st.v;
  } else {
    const thermo = clamp((T.coolant - 82) / 8, 0, 1);
    if (T.coolant > 101) st.fan = true;
    else if (T.coolant < 96) st.fan = false;
    const fan = st.fan && st.key;
    k = 0.012 + thermo * (0.55 + 0.05 * st.v) + (fan ? 0.9 * thermo : 0);   // kW/K
  }
  T.coolant += (heat - k * (T.coolant - T.amb)) / 9 * dt;
  T.oil += ((T.coolant + 6 + st.rpm / (E.limit / 14)) - T.oil) * (1 - Math.exp(-dt / 25));
  const load = st.comb * clamp(st.pr, 0, 1);
  const egtT = st.rpm < 50 ? T.amb : st.comb > 0 ? E.egt.idle + E.egt.load * load + E.egt.rpm * st.rpm / E.limit + 300 * (st.lambda - 0.88) - 6 * (st.adv - st.advBase)
    : 160 + 0.02 * st.rpm;
  T.egt += (egtT - T.egt) * (1 - Math.exp(-dt / (egtT > T.egt ? 1.2 : 3)));
}

// ---------- curva do dinamômetro (plena carga, estado estável) ----------
export function wotCurve(P, rpmMax) {
  const E = profile(P);
  rpmMax = rpmMax || E.rpmMax;
  const out = [], stepR = Math.max(25, Math.round(E.limit / 150 / 25) * 25);
  for (let rpm = Math.round(E.idle / 100) * 100; rpm <= rpmMax; rpm += stepR) {
    let cam;
    if (!E.shiftCam || P.shiftCam === 'full') cam = 1; else if (P.shiftCam === 'part') cam = 0; else cam = rpm > E.shiftCam ? 1 : 0;
    const tps = (MODES[P.mode] || MODES.road).max;
    const pr = solvePr(throttleArea(tps), rpm, cam, P.failFilter, E);
    const lam = lambdaTarget(tps, rpm, E) / P.fuel;
    const fl = clamp((pr - 0.08) / (WOT_PR - 0.08), 0, 1);
    const fs = clamp((rpm - E.float) / (1000 * E.limit / 14600), 0, 1);
    let T = indWot(rpm, cam, E) * fl * etaLambda(lam) * etaAdvance(P.advance) * etaCr(P.cr, E) * etaExhaust(P, rpm, E) * (1 - 0.6 * fs);
    if (P.failSpark) T *= 1 - 1 / E.cyl;
    T -= friction(rpm, E) + pumping(pr, E);
    out.push({ rpm, T, kw: T * rpm / RPM / 1000 });
  }
  return out;
}

export const cv = (kw) => kw / 0.7355;
export { ENGINES, profile };
