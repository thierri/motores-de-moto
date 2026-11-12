// Física do motor (4 em linha ou V-Twin), do câmbio e da moto. Não sabe que existe SVG nem áudio.
// Modelo quase-estático: a pressão no coletor sai do equilíbrio de vazões (borboleta = cilindros),
// o torque sai da curva de plena carga × enchimento × eficiências, e o virabrequim integra J·dω/dt.
// Tudo o que muda de um motor para outro vem do perfil E = ENGINES[P.engine] (config.js).
import { ENGINES, MODES, profile, exhaustOpen } from '../config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const RPM = 60 / (2 * Math.PI);
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
const smooth = (x, a, b) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

// ---------- turbo e Wankel ----------
// pressão que o turbo consegue fazer num giro (bar acima da atmosfera): abaixo de ~1.500 rpm falta gás de escape
export function boostAvail(rpm, P, E) {
  if (!E.turbo) return 0;
  return (P.boost ?? E.turbo.boost) * smooth(rpm, E.turbo.spool[0], E.turbo.spool[1]);
}
// a curva de torque vale para a pressão nominal; outra pressão muda a densidade do ar que entra
const boostMul = (b, E) => (E.turbo ? Math.pow((1 + b) / (1 + E.turbo.boost), 0.9) : 1);
// janela de admissão ampliada (bridgeport) no rotativo: mais força em cima, menos embaixo, lenta irregular
function portMul(rpm, P, E) {
  let k = 1;
  if (E.rotary && P.port === 'bridge') k *= 1 + 0.1 * smooth(rpm, 5000, 8000) - 0.12 * (1 - smooth(rpm, 2000, 4500));
  if (E.rotary && P.failApex) k *= 0.7 + 0.12 * smooth(rpm, 2500, 7000);   // vedação gasta vaza mais em giro baixo
  return k;
}
// ângulo do ciclo (0–720°) de um cilindro; no Wankel, da primeira câmara do rotor (3 voltas do eixo por ciclo)
export function localAngle(st, P, E, cyl = 0) {
  const off = (E.firing[P.crank] || Object.values(E.firing)[0])[cyl] || 0;
  if (E.rotary) return ((((st.vis.long - off) % 1080) + 1080) % 1080) * 2 / 3;
  return ((st.vis.theta - off) % 720 + 720) % 720;
}
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
  const E = profile(P), amb = (E.car && P.amb != null) ? P.amb : 25;
  return {
    t: 0,
    input: { grip: 0, start: false, clutch: 0, brake: 0 },
    key: false, run: true, pumpT: 0, primed: false, choke: false,
    crankAcc: 0, fires: 0, crankP: 0, fragile: 0, cough: 0, kickT: 0,
    omega: 0, rpm: 0, running: false, starter: false, broken: null, crankMsg: '',
    tps: 0, tpsReq: 0, idleA: 0.0045, idleI: 0, pr: 1, cam: 0, camFull: false,
    lambda: 1, adv: 0, retard: 0, knock: 0, knockT: 0, float: 0, overT: 0,
    cut: { lim: false, decel: false, qs: 0, any: false },
    blip: 0, blipTps: 0,
    Tind: 0, Tb: 0, Tc: 0, kw: 0, comb: 0,
    gear: 0, v: 0, dist: 0, locked: false, slip: 0, dtc: 1, dtcOn: false, wheelie: false, accel: 0,
    temp: { coolant: amb + 10, oil: amb + 8, egt: amb, amb, rad: amb + 2 }, fan: false, oilP: 0, fuelLh: 0,
    // carros: turbo, clima, sistema de arrefecimento e pneus
    boost: 0, spool: 0, map: 1, bovArm: false, ac: false, heater: false,
    coolLvl: 1, steam: 0, fanSpd: 0, thermo: 0, hotT: 0, spin: false, lumpAcc: 0, lump: 1,
    msg: '', msgT: 0,
    vis: { theta: 0, rpm: 0, long: 0 },
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
  if (E.car) return shiftCar(st, P, E, dir);
  let ng;
  if (dir === 0) {
    if (g !== 1 && g !== 2) { say(st, 'O neutro fica entre a 1ª e a 2ª (padrão 1-N-2-3-4-5-6).'); return; }
    ng = 0;
  } else if (dir > 0) ng = g === 0 ? 2 : Math.min(E.gearbox.ratios.length - 1, g + 1);
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

// Câmbio de carro (em H): N pode ser escolhido de qualquer marcha; toda troca pede a embreagem
function shiftCar(st, P, E, dir) {
  const g = st.gear, top = E.gearbox.ratios.length - 1;
  const ng = dir === 0 ? 0 : dir > 0 ? Math.min(top, g + 1) : Math.max(1, g - 1);
  if (ng === g) return;
  const pulled = st.input.clutch > 0.6;
  if (!pulled && ng !== 0) {
    st.snd.grind = 1;
    say(st, 'Pise na embreagem (C) para engatar a marcha.');
    return;
  }
  if (ng > 0) {
    const w = (st.v / E.bike.r) * gearRatio(ng, E) * RPM;
    if (w > P.limit * 1.08) { say(st, `Redução recusada: o motor iria a ${Math.round(w / 100) * 100} rpm.`); return; }
  }
  st.gear = ng;
  st.locked = false;
  st.snd.shift = dir || 0.5;
  st.snd.clunk = 1;
  // punta-tacco: uma acelerada na redução iguala o giro do motor ao da marcha de baixo
  if (dir < 0 && g > 1 && P.revMatch && st.running && st.v > 3) { st.blip = 0.22; st.blipTps = 0.34; }
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
  // carburador: a cuba já está cheia, não há bomba elétrica
  if (st.key && !st.wasKey) { st.pumpT = E.carb ? 0 : 2.0; st.primed = !!E.carb; }
  st.wasKey = st.key;
  if (!st.key) { st.primed = false; st.pumpT = 0; }
  if (st.pumpT > 0) { st.pumpT -= dt; if (st.pumpT <= 0) st.primed = true; }
  const pumpOn = !E.carb && st.key && (st.pumpT > 0 || st.running);

  // motor de partida: só em neutro ou com embreagem puxada
  const canCrank = st.key && st.run && !st.broken;
  const allowStart = st.gear === 0 || inp.clutch > 0.6;
  st.starter = !E.kick && inp.start && canCrank && !st.running && allowStart;
  if (st.kickT > 0) st.kickT -= dt;
  if (!E.kick && inp.start && canCrank && !st.running && !allowStart && st.msgT <= 0) say(st, E.car ? 'Para dar partida engatado, pise na embreagem (C).' : 'Para dar partida engrenado, puxe a embreagem (C).');
  if (!E.kick && inp.start && canCrank && !st.running && allowStart && !st.primed && st.msgT <= 0) say(st, 'A bomba de combustível ainda está escorvando: segure a partida mais um pouco.', 1.5);

  // acelerador eletrônico
  const grip = clamp(inp.grip, 0, 1);
  let req = Math.pow(grip, mode.exp) * mode.max;
  if (st.blip > 0) { st.blip -= dt; req = Math.max(req, st.blipTps); }
  st.tpsReq = req;
  st.tps += (req - st.tps) * (1 - Math.exp(-dt / mode.tau));

  // marcha lenta (PI na válvula de ar) com marcha lenta acelerada a frio
  const cold = clamp((60 - st.temp.coolant) / 40, 0, 1);
  // afogador (carburador): acelera a lenta e enriquece a mistura
  const choke = E.carb && st.choke;
  const acOn = !!E.car && st.ac && st.running;
  const idleT = P.idle * (1 + 0.36 * cold) + (choke ? 500 : 0) + (acOn ? 90 : 0);
  const ib = idleBase(E), ik = ib / 0.0036, rs = E.idle / 1250;   // escala do controle para cada motor
  if (st.running && grip < 0.02) {
    const e = clamp((idleT - st.rpm) / (1000 * rs), -0.6, 0.6);
    // derivada da rotação amortece a oscilação (o coletor atrasa a resposta)
    const dr = (st.rpm - (st.rpmPrev ?? st.rpm)) / dt / (1000 * rs);
    if (st.rpm < idleT + 400 * rs || (E.carb && !st.cut.lim)) st.idleI = clamp(st.idleI + e * 0.0035 * ik * dt, -0.0025 * ik, 0.01 * ik);
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

  // turbo: a turbina leva um tempo para acelerar (lag), maior em giro baixo; ao fechar a borboleta a pressão some
  if (E.turbo) {
    const want = st.running && !st.broken ? boostAvail(st.rpm, P, E) * clamp((prT - 0.7) / 0.25, 0, 1) : 0;
    const tb = want > st.boost ? E.turbo.lag * (0.5 + 1.2 * (1 - clamp(st.rpm / (0.6 * E.limit), 0, 1))) : 0.12;
    if (st.boost > 0.3 && st.tps > 0.4) st.bovArm = true;
    if (st.bovArm && st.tps < 0.15 && st.boost > 0.2) { st.snd.bov = st.boost; st.bovArm = false; st.bovT = 0.5; }
    if (st.boost < 0.1) st.bovArm = false;
    if (st.bovT > 0) st.bovT -= dt;
    st.boost += (want - st.boost) * (1 - Math.exp(-dt / tb));
    const sp = st.running && !st.broken ? clamp(0.1 + 0.22 * st.rpm / E.limit * (0.4 + 0.6 * st.pr) + 0.75 * st.boost / Math.max(0.3, E.turbo.boost), 0, 1.4) : 0;
    st.spool += (sp - st.spool) * (1 - Math.exp(-dt / (sp > st.spool ? 0.3 : 1.1)));
  }
  st.map = st.pr * (1 + st.boost);

  // cortes de combustível
  if (st.cut.qs > 0) st.cut.qs -= dt;
  if (st.rpm >= P.limit) st.cut.lim = true;
  else if (st.rpm < P.limit - 200 * (E.limit / 14600) ** 0.5) st.cut.lim = false;
  if (!E.carb && grip < 0.02 && st.blip <= 0 && st.rpm > idleT + 650 * rs && st.running) st.cut.decel = true;
  else if (st.rpm < idleT + 350 * rs || grip >= 0.02) st.cut.decel = false;
  st.cut.any = st.cut.lim || st.cut.decel || st.cut.qs > 0;

  // mistura e ignição
  st.lambda = lambdaTarget(st.tps, st.rpm, E) / P.fuel * (choke ? 0.8 : 1) * (E.carb && !choke ? 1 + 0.12 * cold : 1);
  st.advBase = advanceMap(st.rpm, st.pr, E);
  const advDelta = P.advance - st.retard;
  st.adv = st.advBase + advDelta;

  // combustão
  const fire = st.running && st.primed && st.key && st.run && !st.broken;
  let comb = fire ? 1 : 0;
  if (fire && P.failSpark) comb *= 1 - 1 / E.cyl;
  if (fire && choke && st.temp.coolant > 60) comb *= 0.82;   // afogando: mistura rica demais
  if (fire && st.fragile > 0) comb *= 0.75 + 0.25 * Math.random();
  if (fire && st.lambda > 1.3) comb *= clamp(1 - (st.lambda - 1.3) * 3, 0, 1);
  // Wankel com janela ampliada: na lenta, parte das explosões falha (o "brap-brap")
  if (E.rotary) {
    st.lumpAcc += st.rpm / 60 * 2 * dt;
    if (st.lumpAcc >= 1) {
      st.lumpAcc -= Math.floor(st.lumpAcc);
      const pMiss = (P.port === 'bridge' ? 0.3 : 0) * (1 - smooth(st.rpm, 1300, 2600)) + (P.failApex ? 0.12 * (1 - smooth(st.rpm, 1500, 4000)) : 0);
      st.lump = Math.random() < pMiss ? 0.1 : 1;
    }
    if (fire) comb *= st.lump;
  }
  if (st.cut.any) comb = 0;
  st.comb = comb;
  let softLim = 1;
  const sw = 250 * (E.limit / 14600) ** 0.5, sl0 = P.limit - sw;
  if (st.rpm > sl0) softLim = clamp(1 - 0.5 * (st.rpm - sl0) / sw, 0.5, 1);
  const fw = 1000 * E.limit / 14600;
  st.float = clamp((st.rpm - E.float) / fw, 0, 1);
  const eff = etaLambda(st.lambda) * etaAdvance(advDelta) * etaCr(P.cr, E) * etaExhaust(P, st.rpm, E);
  const fill = clamp((st.pr - 0.08) / (WOT_PR - 0.08), 0, 1);
  // superaquecendo: a central corta potência para proteger o motor
  const hotLim = E.car && st.temp.coolant > 116 ? clamp(1 - (st.temp.coolant - 116) / 22, 0.4, 1) : 1;
  st.Tind = indWot(st.rpm, st.cam, E) * fill * eff * comb * softLim * (1 - 0.6 * st.float) * st.dtc
    * boostMul(st.boost, E) * portMul(st.rpm, P, E) * hotLim;
  let loss = friction(st.rpm, E) + pumping(st.pr, E) + (acOn ? 9 : 0);
  if (st.broken) loss = loss * 6 + 25;
  const batt = E.car && P.failBatt ? 0.5 : 1;   // bateria fraca: a partida gira devagar
  const Tst = st.starter ? Math.max(0, E.starterT * batt * (1 - st.rpm / (E.crankRpm * (batt < 1 ? 0.6 : 1)))) : 0;
  const Tnet = st.Tind - (st.omega > 0.5 ? loss : Math.min(loss, st.Tind + Tst)) + Tst;
  st.Tb = st.Tind - loss;

  // detonação
  const lean = Math.max(0, st.lambda - 0.9), rich = Math.max(0, 0.88 - st.lambda);
  const K = fill * fill * comb * (0.6 * (P.cr - E.cr) + 0.15 * advDelta + 4 * lean - 2 * rich
    + 0.03 * (st.temp.coolant - 100) + 0.55 * (1 - st.rpm / (0.82 * E.limit))
    + (E.turbo ? 1.3 * (st.boost - E.turbo.boost) : 0));
  st.knock = clamp((K - 0.75) * 1.6, 0, 1);
  if (P.knockCtl) {
    if (st.knock > 0) st.retard = Math.min(14, st.retard + 30 * st.knock * dt);
    else st.retard = Math.max(0, st.retard - 1.5 * dt);
  } else st.retard = Math.max(0, st.retard - 5 * dt);
  st.knockT = st.knock > 0.45 && !P.knockCtl ? st.knockT + dt : Math.max(0, st.knockT - dt * 0.5);
  if (st.knockT > 5 && !st.broken) breakEngine(st, 'Detonação forte por tempo demais: o pistão furou.');
  st.overT = st.rpm > E.breakRpm ? st.overT + dt : 0;
  if (st.overT > 0.25 && !st.broken) breakEngine(st, E.rotary ? 'Sobregiro: as vedações de ápice saltaram e riscaram a carcaça.' : 'Sobregiro: uma válvula flutuou e bateu no pistão.');

  // trem de força
  drivetrain(st, P, Tnet, J, dt, E);
  st.rpm = st.omega * RPM;

  // pega e apaga
  startModel(st, P, E, dt, cold, choke);
  if (st.running && (st.rpm < 110 || !st.key || !st.run || st.broken)) {
    if (st.running && st.rpm < 110 && st.key && st.run && !st.broken && !st.starter) say(st, st.gear ? 'O motor apagou: soltou a embreagem com pouco giro.' : 'O motor apagou.');
    if (st.running && E.car && !st.broken) st.temp.soak = 1;
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
  // st.visRpm: o roteiro do vídeo pode fixar a velocidade do desenho (os quatro tempos sincronizados com a fala)
  const vrpm = st.visRpm != null ? st.visRpm : P.anim === 'real' ? st.rpm : 40 * Math.pow(Math.max(0, st.rpm) / 1000, 0.7);
  st.vis.rpm = vrpm;
  st.vis.theta = (st.vis.theta + vrpm / 60 * 360 * dt) % 720;
  st.vis.long = (st.vis.long + vrpm / 60 * 360 * dt) % 2160;   // para o rotor do Wankel (1/3 da rotação do eixo)
}

// Partida: o motor não pega na hora. A cada compressão girando na partida (ou no pedal) há uma chance de
// a mistura explodir ("tossir"); depois de algumas explosões seguidas ele pega. Frio é mais difícil e pode
// pegar e morrer. Injeção: acelerador todo aberto corta a injeção (desafogar). Carburador: precisa do
// afogador frio; com o afogador e o motor quente, afoga.
function startModel(st, P, E, dt, cold, choke) {
  st.crankP = 0;
  // st.forceP: o roteiro do vídeo fixa a chance de explodir (0 = não pega, 1 = pega) e o motor não morre
  if (st.forceP != null) st.fragile = 0;
  if (st.fragile > 0) {
    st.fragile -= dt;
    if (st.running && Math.random() < dt * 0.9 * cold * (choke ? 0.1 : 1)) {
      st.running = false; st.fires = 0; st.fragile = 0;
      say(st, E.carb ? 'Pegou e morreu: motor frio. Use o afogador (A).' : 'Pegou e morreu: o motor está frio. Tente de novo.');
    }
  }
  const able = !st.running && st.key && st.run && st.primed && !st.broken && st.rpm > (E.kick ? 120 : 100);
  if (!able) { if (st.rpm < 40) { st.fires = 0; st.crankAcc = 0; } return; }
  let p;
  if (E.carb) {
    const warm = 1 - cold;
    p = choke ? 0.55 * cold + 0.12 * warm : 0.06 * cold + 0.35 * warm;
    if (st.input.grip > 0.5) p *= 0.4;
  } else {
    p = 0.45 - 0.3 * cold;
    if (E.car) {
      if (st.rpm < 170) p *= clamp((st.rpm - 95) / 75, 0.05, 1);    // girando devagar (bateria fraca), custa a pegar
      if (P.failApex) p *= 0.3;                                     // sem compressão, o rotativo custa a pegar
      if (E.rotary && cold > 0.5 && st.fires === 0) p *= 0.75;
    }
    if (st.input.grip > 0.85) { p = 0; if (st.msgT <= 0) say(st, 'Acelerador todo aberto na partida: a injeção corta o combustível (desafogar).', 2); }
  }
  if (P.failSpark && E.cyl === 1) p = 0;
  if (st.forceP != null) p = st.forceP;
  st.crankP = p;
  st.crankAcc += st.rpm / 60 * (E.firesPerRev || Math.max(1, E.cyl) / 2) * dt;
  while (st.crankAcc >= 1) {
    st.crankAcc -= 1;
    if (Math.random() < p) {
      st.fires++;
      st.cough = 1;
      st.omega += (E.kick ? 25 : 12);      // a explosão dá um empurrão no virabrequim
      if (st.fires >= E.needFires) {
        st.running = true; st.fires = 0; st.fragile = cold > 0.2 ? 1.5 : 0;
        if (st.msgT > 0 && /morreu|afog|escorv/.test(st.msg)) st.msgT = 0;
        break;
      }
    }
  }
}

// Pedal de partida (CG): um chute gira o motor rápido por um instante
export function kick(st, P) {
  const E = profile(P);
  if (!E.kick || st.running || st.broken || st.kickT > 0) return;
  if (st.gear !== 0 && st.input.clutch < 0.6) { say(st, 'Para dar partida no pedal, coloque em neutro (N) ou puxe a embreagem (C).'); return; }
  st.kickT = 0.45;
  st.snd.kick = 1;
  if (!st.key) { say(st, 'Ligue a chave (I) antes de dar partida.'); }
  st.omega = Math.max(st.omega, (680 + 160 * Math.random()) / RPM);
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
  // carro: os pneus limitam a força (patinam); o controle de tração corta o motor um pouco antes
  const car = !!E.car;
  const amax = car ? (P.dtc ? 0.86 * BIKE.grip : 99) * G : (P.dtc ? 1.0 : 1.5) * G;
  st.slip = 0;
  let spin = false;
  if (!g) {
    st.omega = Math.max(0, st.omega + Tnet / J * dt);
    st.v = Math.max(0, st.v - Fres / M * dt);
    st.locked = false;
    st.Tc = 0;
  } else {
    const i = gearRatio(g, E), eta = GEARBOX.eff;
    const e = 1 - clamp(inp.clutch, 0, 1);
    const capCl = GEARBOX.clutchMax * e * e * e;
    const tire = car ? BIKE.grip * M * G * r / (i * eta) : Infinity;
    const cap = Math.min(capCl, tire);
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
      spin = car && tire < capCl && d > 0 && st.slip > 40;
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
  st.wheelie = !car && g > 0 && st.accel > 1.05 * G;
  st.spin = spin;
  st.dist += st.v * dt;
}

// Arrefecimento do carro. Dois "tanques" de água: o do motor (T.coolant) e o do radiador (T.rad).
// A bomba faz a água circular; a válvula termostática só libera o radiador acima de ~88 °C; o radiador
// perde calor para o ar (vento da estrada ou ventoinha). Aquecimento acelerado para o simulador.
// Passando de 116 °C a central corta potência; acima de 120 °C a água ferve e vai embora pelo
// reservatório; se insistir, a junta do cabeçote queima.
function thermalCar(st, P, pind, dt, E) {
  const T = st.temp;
  T.amb = P.amb ?? 25;
  const run = st.running && !st.broken;
  const fuelKw = pind / 0.34 / 1000;
  let heat = run ? E.heat * Math.sqrt(Math.max(0.5, fuelKw)) : 0;
  // motor desligado quente: o calor do metal ainda passa para a água parada
  if (!run && T.soak > 0) { heat = 1.2 * T.soak; T.soak = Math.max(0, T.soak - dt / 20); }
  const acOn = st.ac && run;
  if (acOn) heat += 0.4;

  // nível da água: vazamento ou fervura
  if (P.failLeak && st.coolLvl > 0.25) st.coolLvl -= dt * (run ? 0.008 : 0.003);
  const boil = clamp((T.coolant - 120) / 8, 0, 1);
  const wet = st.coolLvl > 0.1;
  if (boil > 0 && wet) st.coolLvl -= dt * 0.012 * boil;
  st.steam += ((wet ? boil : 0) - st.steam) * (1 - Math.exp(-dt / 0.6));
  const lvl = smooth(st.coolLvl, 0.2, 0.75);

  // válvula termostática (cera que derrete e abre a passagem)
  const thT = P.thermo === 'closed' ? 0.02 : P.thermo === 'open' ? 1 : clamp((T.coolant - 88) / 8, 0, 1);
  st.thermo += (thT - st.thermo) * (1 - Math.exp(-dt / 1.5));
  // ventoinha elétrica: liga a 98 °C e desliga a 91 °C; o ar-condicionado também a liga
  if (P.fan === 'on') st.fan = true;
  else if (P.fan === 'off') st.fan = false;
  else {
    if (T.coolant > 98) st.fanHot = true; else if (T.coolant < 91) st.fanHot = false;
    st.fan = !!st.fanHot || acOn;
  }
  // segunda velocidade (mais forte) acima de 105 °C
  if (T.coolant > 105) st.fanHi = true; else if (T.coolant < 100) st.fanHi = false;
  const fanOn = st.fan && st.key;
  const fanT = fanOn ? (st.fanHi ? 1.9 : 1) : 0;
  st.fanSpd += (fanT - st.fanSpd) * (1 - Math.exp(-dt / (fanT > st.fanSpd ? 0.5 : 1.8)));

  const pump = run ? 0.35 + 0.65 * clamp(st.rpm / (0.5 * E.limit), 0, 1) : 0.03;
  const qER = 2.4 * st.thermo * pump * lvl * (T.coolant - T.rad);                     // motor → radiador (kW)
  const kAir = (0.03 + 0.02 * st.v + 0.11 * Math.min(1, st.fanSpd) + 0.2 * Math.max(0, st.fanSpd - 1)) * (P.failRad ? 0.3 : 1);
  const qRA = kAir * (T.rad - T.amb - (acOn ? 8 : 0));                                // radiador → ar
  const qHeater = st.heater && st.key ? 0.06 * pump * lvl * (T.coolant - 22) : 0;    // ar quente da cabine
  const qBlock = 0.012 * (T.coolant - T.amb);
  const qBoil = wet ? 7 * boil : 0;                                                    // ferver rouba calor (enquanto houver água)
  T.coolant += (heat - qER - qHeater - qBlock - qBoil) / (2.2 + 1.0 * lvl) * dt;
  T.rad += (qER - qRA) / (0.3 + 0.7 * lvl) * dt;
  T.coolant = Math.min(T.coolant, 142);

  // avisos e dano
  if (run && T.coolant > 116 && st.msgT <= 0) say(st, T.coolant > 120 ? 'A água está fervendo! Desligue o motor ou ligue o ar quente.' : 'Superaquecendo: a central cortou potência. Alivie o motor.', 2.5);
  st.hotT = T.coolant > 128 && run ? st.hotT + dt : Math.max(0, st.hotT - dt * 0.3);
  if (st.hotT > 8 && !st.broken) breakEngine(st, E.rotary ? 'Superaquecimento: a carcaça empenou e as vedações do rotor cederam.' : 'Superaquecimento: a junta do cabeçote queimou.');

  T.oil += ((T.coolant + 6 + st.rpm / (E.limit / 14)) - T.oil) * (1 - Math.exp(-dt / 25));
  const load = st.comb * clamp(st.map, 0, 1.6);
  const egtT = st.rpm < 50 ? T.amb : st.comb > 0 ? E.egt.idle + E.egt.load * Math.min(1.15, load) + E.egt.rpm * st.rpm / E.limit + 300 * (st.lambda - 0.88) - 6 * (st.adv - st.advBase)
    : 160 + 0.02 * st.rpm;
  T.egt += (egtT - T.egt) * (1 - Math.exp(-dt / (egtT > T.egt ? 1.2 : 3)));
}

function thermal(st, P, pind, dt, E) {
  if (E.car) return thermalCar(st, P, pind, dt, E);
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
    let T = indWot(rpm, cam, E) * fl * etaLambda(lam) * etaAdvance(P.advance) * etaCr(P.cr, E) * etaExhaust(P, rpm, E) * (1 - 0.6 * fs)
      * boostMul(boostAvail(rpm, P, E), E) * portMul(rpm, P, E);
    if (P.failSpark) T *= 1 - 1 / E.cyl;
    T -= friction(rpm, E) + pumping(pr, E);
    out.push({ rpm, T, kw: T * rpm / RPM / 1000 });
  }
  return out;
}

export const cv = (kw) => kw / 0.7355;
export { ENGINES, profile };
