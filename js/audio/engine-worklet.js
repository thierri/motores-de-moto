// Sintetizador do motor (4 em linha ou V-Twin), roda na thread de áudio.
// O worklet integra o próprio ângulo do virabrequim a partir do rpm. A cada abertura da válvula de escape
// de um cilindro nasce um pulso de pressão (forma descrita em graus do virabrequim, então encurta sozinha
// quando o giro sobe). Os pulsos entram nos tubos do escape 4-2-1, modelados como guias de onda (atrasos
// com o comprimento de cada tubo e reflexão na ponta), e depois no silencioso.
// A configuração de cada motor (cilindros, ângulos de explosão, tubos, pulso, silencioso) chega pela porta
// (mensagem { cfg }) ou em processorOptions.cfg.
// Saída: 3 canais = [escape, admissão, mecânica], misturados no grafo principal.

const TAU = Math.PI * 2;

class Comb {
  // tubo: y[n] = x[n] + g·passa-baixa(y[n − D]), D = ida e volta do pulso no tubo
  constructor(maxSamples) { this.b = new Float32Array(maxSamples); this.n = maxSamples; this.w = 0; this.lp = 0; }
  run(x, D, g, damp) {
    let r = this.w - D;
    while (r < 0) r += this.n;
    const i = r | 0, f = r - i, j = (i + 1) % this.n;
    const d = this.b[i] * (1 - f) + this.b[j] * f;
    this.lp += (d - this.lp) * damp;
    const y = x + g * this.lp;
    this.b[this.w] = y;
    this.w = (this.w + 1) % this.n;
    return y;
  }
}

class Delay {
  constructor(n) { this.b = new Float32Array(n); this.n = n; this.w = 0; }
  run(x, D) {
    let r = this.w - D; while (r < 0) r += this.n;
    const i = r | 0, f = r - i, y = this.b[i] * (1 - f) + this.b[(i + 1) % this.n] * f;
    this.b[this.w] = x; this.w = (this.w + 1) % this.n;
    return y;
  }
}

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set('lp', 1000, 0.7, 48000); }
  set(type, f, q, sr) {
    const w = TAU * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // passa-faixa (ganho 1 no pico)
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ressonador amortecido (anel): bom para bloco do motor e detonação
class Ring {
  constructor(f, decay, sr) { this.y1 = 0; this.y2 = 0; this.tune(f, decay, sr); }
  tune(f, decay, sr) {
    const r = Math.exp(-1 / (decay * sr));
    this.a1 = 2 * r * Math.cos(TAU * f / sr); this.a2 = -r * r;
    this.g = (1 - r * r) * 0.5;
  }
  run(x) { const y = this.g * x + this.a1 * this.y1 + this.a2 * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
}

// configuração padrão: 4 em linha, virabrequim plano
const DEF = {
  n: 4, off: [0, 180, 540, 360], evo: 494, evc: 746, ivo: 694, ivc: 226,
  prim: [0.62, 0.64, 0.61, 0.63], groups: [{ cyl: [0, 3], L: 0.38 }, { cyl: [1, 2], L: 0.39 }], coll: 0.55,
  tail: [0.42, 0.42, 0.30],
  pulse: { rise: 3, decay: 11, plat: 0.16, turb: 0.16, base: 0.26, baseLoad: 0.12, comb: 0.95, len: 260 },
  muf: [
    { f: 1100, flap: 1900, boom: 78, gain: 0.55, gainFlap: 0.25, sat: 0.6, g: -0.35 },
    { f: 3400, flap: 0, boom: 105, gain: 0.95, gainFlap: 0, sat: 1.0, g: -0.5 },
    { f: 6500, flap: 0, boom: 140, gain: 1.25, gainFlap: 0, sat: 1.5, g: -0.62 },
  ],
  airbox: 190, inRun: 0.13, block: [170, 380, 1150], ticks: [3900, 6100], tickAmp: [0.05, 0.25],
  whine: [23, 37], whineAmp: [0.012, 0.006], idleVarRpm: 6000, rpmRef: 14000, mech: 0.35, out: 1.5,
};

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = (name, def, min = 0, max = 1) => ({ name, defaultValue: def, minValue: min, maxValue: max, automationRate: 'k-rate' });
    return [
      p('rpm', 0, 0, 20000), p('load', 0, 0, 2), p('fuel', 0), p('throttle', 0), p('cam', 0),
      p('egt', 300, 0, 1200), p('knock', 0), p('float', 0), p('pop', 0), p('flap', 0),
      p('misfire', 0, 0, 4), p('idleRough', 0.1), p('open', 0, 0, 1.5), p('pipeLen', 1, 0.5, 2),
    ];
  }

  constructor(opt) {
    super();
    this.sr = sampleRate;
    this.seed = (opt && opt.processorOptions && opt.processorOptions.seed) || 22222;
    this.phi = 0;
    this.rpm = 0;
    this.big = Math.ceil(this.sr * 0.03);
    this.ground = new Delay(this.big);
    this.port.onmessage = (e) => { if (e.data && e.data.cfg) this.configure(e.data.cfg); };
    this.mufLp = new Biquad(); this.mufLp2 = new Biquad(); this.mufBoom = new Biquad();
    this.hp = new Biquad(); this.hp.set('hp', 28, 0.7, this.sr);
    this.airbox = new Biquad();
    this.hiss = new Biquad(); this.hiss.set('bp', 1600, 0.9, this.sr);
    this.inLp = new Biquad(); this.inLp.set('lp', 2400, 0.7, this.sr);
    this.ping = new Ring(6600, 0.0035, this.sr);
    this.pops = [];
    this.lastEx = 0; this.lastMuf = 0;
    this.chainPh = 0; this.primPh = 0;
    this.mufType = -1; this.mufF = 0;
    this.blockRpm = -1;
    this.popEnv = 0;
    this.configure((opt && opt.processorOptions && opt.processorOptions.cfg) || DEF);
  }

  configure(cfg) {
    const c = this.cfg = { ...DEF, ...cfg };
    const sr = this.sr, big = this.big;
    this.cyl = Array.from({ length: c.n }, () => ({ d: 999, A: 0, burn: false, di: 999, Ai: 0 }));
    this.prim = c.prim.map(() => new Comb(big));
    this.sec = (c.groups || []).map(() => new Comb(big));
    this.coll = new Comb(big);
    this.tail = new Comb(big);
    this.inRun = new Comb(big);
    this.pv = new Float32Array(c.n);
    this.airbox.set('bp', c.airbox, 2.2, sr);
    this.block = [new Ring(c.block[0], 0.012, sr), new Ring(c.block[1], 0.006, sr), new Ring(c.block[2], 0.003, sr)];
    this.tick = new Ring(c.ticks[0], 0.0005, sr);
    this.tick2 = new Ring(c.ticks[1], 0.00035, sr);
    this.mufO = -1; this.blockRpm = -1;
    this.pops = [];
  }

  rnd() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  gauss() { return (this.rnd() + this.rnd() + this.rnd() - 1.5) * 1.15; }

  // silencioso contínuo: abertura o = 0 (original fechado) … 0,5 (esportivo) … 1 (aberto) … >1 (sem silencioso)
  mufAt(o) {
    const m = this.cfg.muf, t = this.cfg.tail;
    const lerp = (a, b, k) => a + (b - a) * k;
    let M, tail;
    if (o <= 0.5) {
      const k = o / 0.5, A = m[0], B = m[1];
      M = { f: lerp(A.f, B.f, k), flap: lerp(A.flap, B.flap, k), boom: lerp(A.boom, B.boom, k), gain: lerp(A.gain, B.gain, k), gainFlap: lerp(A.gainFlap, B.gainFlap, k), sat: lerp(A.sat, B.sat, k), g: lerp(A.g, B.g, k) };
      tail = lerp(t[0], t[1], k);
    } else {
      const k = Math.min(1, (o - 0.5) / 0.5), A = m[1], B = m[2], x = Math.max(0, o - 1);
      M = { f: lerp(A.f, B.f, k) * (1 + 0.8 * x), flap: 0, boom: lerp(A.boom, B.boom, k) * (1 + 0.3 * x), gain: lerp(A.gain, B.gain, k) * (1 + 0.45 * x), gainFlap: 0, sat: lerp(A.sat, B.sat, k) * (1 + 0.4 * x), g: Math.max(-0.75, lerp(A.g, B.g, k) - 0.1 * x) };
      tail = lerp(t[1], t[2], k) * (1 - 0.5 * Math.min(1, x / 0.3));
    }
    M.tail = tail;
    return M;
  }

  setupMuffler(o, flap) {
    const sr = this.sr;
    const M = this.mufAt(o);
    const f = M.f + M.flap * flap;
    this.M = M;
    if (Math.abs(o - this.mufO) < 0.005 && Math.abs(f - this.mufF) < 20) return;
    this.mufO = o; this.mufF = f;
    this.mufLp.set('lp', Math.min(f, sr * 0.4), 0.75, sr);
    this.mufLp2.set('lp', Math.min(f * 1.6, sr * 0.45), 0.6, sr);
    this.mufBoom.set('bp', M.boom, this.cfg.boomQ || 1.6, sr);
  }

  process(_in, outputs, P) {
    const out = outputs[0];
    const ex = out[0], ia = out[1] || out[0], me = out[2] || out[0];
    const n = ex.length, sr = this.sr;
    const rpmT = P.rpm[0], load = P.load[0], fuel = P.fuel[0], thr = P.throttle[0], cam = P.cam[0];
    const knock = P.knock[0], flt = P.float[0], popP = P.pop[0], flap = P.flap[0];
    const mis = Math.round(P.misfire[0]), rough = P.idleRough[0];
    const C = this.cfg, off = C.off, N = C.n, PU = C.pulse;
    this.setupMuffler(P.open[0], flap);
    const M = this.M, PL = P.pipeLen[0];

    // velocidade do som no escape sobe com a temperatura dos gases: o "tom" dos tubos muda
    const c = 20.05 * Math.sqrt(P.egt[0] + 273);
    const k2 = 2 / c * sr * PL;
    const D3 = C.coll * k2, Dt = M.tail * 2 / c * sr, Di = 2 * C.inRun / 343 * sr;
    const gP = -0.62, gS = -0.5, gC = -0.42, gT = M.g;
    const mufGain = M.gain + M.gainFlap * flap;
    const sat = M.sat;
    const pv = this.pv;

    // ruído do bloco acompanha a rotação (afina levemente)
    if (Math.abs(rpmT - this.blockRpm) > C.rpmRef / 70) {
      this.blockRpm = rpmT;
      this.block[1].tune(C.block[1] + rpmT * 0.012 * (14000 / C.rpmRef), 0.006, sr);
    }

    const tickAmp = C.tickAmp[0] + C.tickAmp[1] * Math.min(1, this.rpm / C.rpmRef);
    for (let s = 0; s < n; s++) {
      this.rpm += (rpmT - this.rpm) * 0.004;
      const dphi = this.rpm / 60 * 360 / sr; // graus por amostra
      const prevPhi = this.phi;
      this.phi += dphi;
      if (this.phi >= 720) this.phi -= 720;

      let intake = 0, mech = 0;
      for (let k = 0; k < N; k++) {
        const cy = this.cyl[k];
        const a0 = ((prevPhi - off[k]) % 720 + 720) % 720;
        const a1 = a0 + dphi;
        // abertura do escape: nasce o pulso
        if (a0 < C.evo && a1 >= C.evo && dphi > 0) {
          const idleVar = rough * Math.max(0, 1 - this.rpm / C.idleVarRpm);
          const burn = fuel > 0 && this.rnd() < fuel && (k + 1) !== mis && !(flt > 0 && this.rnd() < flt * 0.5);
          const jit = 1 + this.gauss() * (0.04 + idleVar);
          cy.burn = burn;
          cy.A = (PU.base + PU.baseLoad * load) + (burn ? load * PU.comb * jit : 0);
          cy.d = 0;
          // pipoco: combustível que sobra queima no escape quando não houve explosão
          if (!burn && popP > 0 && this.rnd() < popP) {
            this.pops.push({ t: 0, len: (0.002 + this.rnd() * 0.006) * sr, A: (0.8 + this.rnd() * 2.2), lp: 0, k: 0.15 + this.rnd() * 0.5 });
          }
          // estalo no bloco a cada explosão
          if (burn) { mech += C.mech * load; if (knock > 0 && this.rnd() < knock) this.pingKick = 0.6 * knock * (0.5 + this.rnd()); }
        }
        // abertura da admissão
        if (a0 < C.ivo && a1 >= C.ivo) { cy.di = 0; cy.Ai = 0.3 + thr * 1.1; }
        // fechamento das válvulas (4 por cilindro): estalinhos no cabeçote
        if ((a0 < C.ivc && a1 >= C.ivc) || (a0 < C.evc - 720 && a1 >= C.evc - 720)) {
          this.tickKick = tickAmp * (1 + (flt > 0 ? this.rnd() * 6 * flt : 0)) * (0.7 + 0.6 * this.rnd());
        }
        // forma do pulso de escape, em graus desde a abertura
        let p = 0;
        if (cy.d < PU.len) {
          const d = cy.d;
          const spike = d < PU.rise ? d / PU.rise : Math.exp(-(d - PU.rise) / PU.decay);
          const turb = 1 + PU.turb * (this.rnd() * 2 - 1) * (cy.burn ? 1 : 0.4);
          p = cy.A * (spike * turb + PU.plat * Math.sin(Math.PI * d / PU.len));
          cy.d += dphi;
        }
        pv[k] = p;
        // pulso de admissão (sucção)
        if (cy.di < 240) {
          const u = Math.sin(Math.PI * cy.di / 240);
          intake -= cy.Ai * u * u;
          cy.di += dphi;
        }
      }

      // ---------- escape 4-2-1 ----------
      for (let k = 0; k < N; k++) pv[k] = this.prim[k].run(pv[k], C.prim[k] * k2, gP, 0.45);
      let mix = 0;
      if (C.groups) {
        for (let g = 0; g < C.groups.length; g++) {
          const G = C.groups[g];
          let x = 0;
          for (const k of G.cyl) x += pv[k];
          mix += this.sec[g].run(0.6 * x, G.L * k2, gS, 0.4);
        }
        mix *= 0.62;
      } else {
        for (let k = 0; k < N; k++) mix += pv[k];
        mix *= 0.75;
      }
      let col = this.coll.run(mix, D3, gC, 0.35);
      // pipocos entram depois dos coletores
      for (let i = this.pops.length - 1; i >= 0; i--) {
        const q = this.pops[i];
        const env = Math.exp(-q.t / (q.len * 0.35)) * (q.t < 8 ? q.t / 8 : 1);
        q.lp += ((this.rnd() * 2 - 1) - q.lp) * q.k;
        col += q.A * env * (q.lp * 1.6 + (q.t < 30 ? 0.6 : 0));
        if (++q.t > q.len * 2.5) this.pops.splice(i, 1);
      }
      // silencioso
      let m = this.tail.run(col, Dt, gT, 0.5);
      m = this.mufLp2.run(this.mufLp.run(m)) + this.mufBoom.run(m) * (C.boomMix ?? 0.6);
      // radiação na ponta do tubo ~ derivada da vazão
      const rad = 0.55 * m + (C.radDiff ?? 2.2) * (m - this.lastMuf);
      this.lastMuf = m;
      let e = this.hp.run(rad) * mufGain;
      e = Math.tanh(e * sat) / sat;
      // reflexo no chão (atraso curto)
      e = e + 0.3 * this.ground.run(e, 0.0016 * sr);
      ex[s] = e * C.out;

      // ---------- admissão ----------
      const ir = this.inRun.run(intake, Di, -0.55, 0.5);
      const box = this.airbox.run(ir) * 2.2;
      const hissN = this.hiss.run(this.rnd() * 2 - 1) * (-intake) * (0.25 + 0.6 * thr);
      ia[s] = this.inLp.run(box * (0.4 + 0.6 * thr) + hissN * (0.5 + this.rpm / (C.rpmRef * 0.65))) * (0.6 + 0.4 * cam);

      // ---------- mecânica ----------
      let mx = 0;
      if (mech) { for (const b of this.block) b.y1 += mech * 0.02; }
      for (const b of this.block) mx += b.run(0);
      if (this.tickKick) { this.tickN = 40; this.tickA = this.tickKick; this.tickKick = 0; }
      let tn = 0;
      if (this.tickN > 0) { tn = (this.rnd() * 2 - 1) * this.tickA * (this.tickN / 40); this.tickN--; }
      mx += this.tick.run(tn) * 0.5 + this.tick2.run(tn) * 0.35;
      if (this.pingKick) { this.ping.y1 += this.pingKick * 0.03; this.pingKick = 0; }
      mx += this.ping.run(0) * 9;
      // corrente de comando e engrenagem primária: zumbidos finos
      const rev = this.rpm / 60;
      this.chainPh += TAU * rev * C.whine[0] / sr; if (this.chainPh > TAU) this.chainPh -= TAU;
      this.primPh += TAU * rev * C.whine[1] / sr; if (this.primPh > TAU) this.primPh -= TAU;
      const whine = Math.min(1, this.rpm / (C.rpmRef * 0.85));
      mx += (Math.sin(this.chainPh) * C.whineAmp[0] + Math.sin(this.primPh) * C.whineAmp[1]) * whine * whine;
      me[s] = mx;
    }
    return true;
  }
}

registerProcessor('engine-i4', EngineProcessor);
