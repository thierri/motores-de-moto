// Roteiro de testes da física, sem navegador: node tools/testsim.mjs [i4|v2|cg|t4|b6|rx]
import { DEFAULTS_BY, ENGINES } from '../js/config.js';
import { createState, step, shift, wotCurve, cv, kick } from '../js/sim/engine.js';

const DT = 1 / 240;
const f = (v, d = 0) => v.toFixed(d).padStart(7);

function test(key) {
  const E = ENGINES[key];
  const P = { ...DEFAULTS_BY[key] };
  const st = createState(P);
  const run = (sec, fn) => { for (let t = 0; t < sec; t += DT) { if (fn) fn(t); step(st, P, DT); } };
  const show = (lbl) => console.log(`${lbl.padEnd(30)} rpm${f(st.rpm)} pr${f(st.pr, 2)} T${f(st.Tb, 1)} cv${f(cv(st.kw), 0)} v${f(st.v * 3.6, 0)}km/h g${st.gear} λ${f(st.lambda, 2)} adv${f(st.adv, 1)} knock${f(st.knock, 2)} Tc${f(st.temp.coolant, 0)}${E.car ? ` rad${f(st.temp.rad, 0)} fan${st.fan ? 1 : 0} b${f(st.boost, 2)}` : ''} egt${f(st.temp.egt, 0)} ${st.cut.any ? 'CUT' : ''} ${st.msg && st.msgT > 0 ? '| ' + st.msg : ''}`);

  console.log(`\n================ ${E.name} ================`);
  const c = wotCurve(P);
  let pk = c[0], tk = c[0];
  for (const p of c) { if (p.kw > pk.kw) pk = p; if (p.T > tk.T) tk = p; }
  const pts = E.car ? [1000, 1500, 2000, 3000, 4000, 5000, 6000, E.limit] : key === 'cg' ? [2000, 4000, 6000, 6500, 8000, 8500, 9500] : key === 'v2' ? [1000, 2000, 3000, 3250, 4000, 5000, 5500] : [2000, 4000, 6000, 8000, 10000, 11000, 12000, 13000, 14600];
  console.log(pts.map((r) => { const p = c.reduce((a, b) => (Math.abs(b.rpm - r) < Math.abs(a.rpm - r) ? b : a)); return `${p.rpm}: ${p.T.toFixed(0)} Nm ${cv(p.kw).toFixed(0)} cv`; }).join(' · '));
  console.log(`pico: ${cv(pk.kw).toFixed(0)} cv a ${pk.rpm} · ${tk.T.toFixed(1)} Nm a ${tk.rpm}`);

  // partida: frio (com afogador na CG) e depois quente; mede o tempo até pegar
  const startUp = (lbl) => {
    let t = 0, kicks = 0;
    if (E.kick) {
      while (!st.running && t < 20) { kick(st, P); kicks++; for (let k = 0; k < 0.7 / DT; k++) { step(st, P, DT); t += DT; if (st.running) break; } }
    } else {
      st.input.start = true;
      while (!st.running && t < 10) { step(st, P, DT); t += DT; }
      st.input.start = false;
    }
    console.log(`  ${lbl}: pegou em ${t.toFixed(2)} s${E.kick ? ` (${kicks} pedaladas)` : ''} ${st.running ? '' : 'NÃO PEGOU'}`);
  };
  st.key = true; run(2.2);
  if (E.carb) st.choke = true;
  startUp('partida fria');
  run(4); show('marcha lenta fria');
  if (!st.running) { startUp('partida fria, 2ª tentativa'); run(3); }
  st.choke = false;
  st.temp.coolant = 85; run(8); show('marcha lenta quente');
  // partida a quente: desliga, liga de novo
  st.key = false; run(4); st.key = true; run(2.2); startUp('partida quente'); run(3);

  st.input.grip = 1;
  let t1 = null;
  run(1.5, (t) => { if (t1 === null && st.rpm >= 0.95 * P.limit) t1 = t; });
  show('acelerador todo 1,5 s'); console.log(`  lenta → 95% do corte em ${t1 != null ? t1.toFixed(2) + ' s' : '—'}`);
  let n = 0, prevCut = false, mn = 1e9, mx = 0;
  run(1, () => { if (st.cut.lim !== prevCut) { n++; prevCut = st.cut.lim; } mn = Math.min(mn, st.rpm); mx = Math.max(mx, st.rpm); });
  console.log(`  no corte: ${n / 2} batidas/s, rpm ${mn.toFixed(0)}–${mx.toFixed(0)}`);
  st.input.grip = 0;
  let td = null; run(3, (t) => { if (td === null && st.rpm < P.idle * 1.6) td = t; });
  show('soltou 3 s'); console.log(`  corte → lenta em ${td?.toFixed(2)} s`);

  st.input.clutch = 1; run(0.3); shift(st, P, -1); run(0.2);
  st.input.grip = 0.35;
  for (let k = 0; k < 60; k++) { st.input.clutch = Math.max(0, 1 - k / 50); run(0.02); }
  show('saída em 1ª');
  st.input.grip = 1;
  let t100 = null, tt = 0;
  for (let k = 0; k < 240 * 25; k++) {
    step(st, P, DT); tt += DT;
    if (t100 === null && st.v * 3.6 >= 100) t100 = tt;
    if (st.rpm > 0.97 * P.limit && st.gear < E.gearbox.ratios.length - 1 && st.cut.qs <= 0) {
      if (!P.qs) { st.input.clutch = 1; step(st, P, DT); }
      shift(st, P, 1);
      st.input.clutch = 0;
    }
  }
  show('fim da aceleração');
  console.log(`  0–100 km/h ${t100?.toFixed(2)} s`);
}

const which = process.argv[2];
for (const k of which ? [which] : Object.keys(ENGINES)) test(k);
