// Som sintetizado da moto (Web Audio), ligado à física.
// Contínuos: motor (worklet: escape 4-2-1, admissão, mecânica), motor de partida, bomba de combustível,
// ventoinha, câmbio, vento e pneus. Eventos: chave, corta-corrente, trocas de marcha, arranhar, quebra.
// O tempo vem de `clock()` quando injetado (gravação offline), senão de ctx.currentTime.

import { profile, exhaustOpen } from '../config.js';


export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.listen = 'rear';   // 'rear' (atrás da moto) | 'rider' (piloto)
    this.clock = null;
    this.seed = 98765;
    this.prev = null;
    this.node = null;
    this.popEnv = 0;
    this.flap = 0;
    this.cutHold = 0;
  }

  rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  get ready() { return !!this.ctx; }
  now() { return this.clock ? this.clock() : this.ctx.currentTime; }

  start(ctx) {
    if (this.ctx) return this.loading;
    this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.build();
    this.loading = this.ctx.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url) + '?v=' + Date.now())
      .then(() => this.buildEngine())
      .catch((e) => console.error('worklet', e));
    return this.loading;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---------- blocos ----------
  noiseBuf(kind, sec = 3) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = this.rand() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  loop(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  gain(v = 0, to) { const g = this.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  filt(type, f, q = 0.7, to) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }
  set(param, v, tc = 0.03) { param.setTargetAtTime(v, this.now(), tc); }

  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / c.sampleRate;
        const er = (Math.abs(t - 0.011 - ch * 0.003) < 0.0006 ? 0.5 : 0) + (Math.abs(t - 0.023 + ch * 0.004) < 0.0006 ? 0.35 : 0);
        d[i] = ((this.rand() * 2 - 1) * Math.exp(-t / decay) + er) * (t < 0.004 ? 0 : 1);
      }
    }
    return b;
  }

  build() {
    const c = this.ctx;
    // saída: master → compressor → limitador → destino (com medidor)
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -5; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001; this.limiter.release.value = 0.08;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -22; this.comp.knee.value = 12; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master = this.gain(0, this.comp);
    this.comp.connect(this.limiter);
    this.limiter.connect(c.destination);
    this.meter = c.createAnalyser(); this.meter.fftSize = 2048;
    this.limiter.connect(this.meter);

    // ambiente: garagem (bancada) ou ar livre (pista)
    this.dry = this.gain(1, this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.1, 0.28);
    this.wet = this.gain(0.16, this.master);
    this.verb.connect(this.wet);
    this.bus = this.gain(1);
    this.bus.connect(this.dry); this.bus.connect(this.verb);
    this.fx = this.gain(0.8, this.bus);   // eventos curtos, canal próprio

    const white = this.noiseBuf('white'), brown = this.noiseBuf('brown');

    // motor de partida: zumbido elétrico + engrenagem raspando
    // motor de partida: zumbido grave do motor elétrico (com harmônico), que pesa e alivia a cada
    // compressão do motor; engrenagens da partida chiando baixo; escovas bem discretas
    this.stG = this.gain(0, this.bus);
    const stLp = this.filt('lowpass', 1800, 0.7, this.stG);
    this.stWhG = this.gain(0.5, stLp);
    const whLp = this.filt('lowpass', 950, 0.8, this.stWhG);
    this.stOsc = c.createOscillator(); this.stOsc.type = 'triangle'; this.stOsc.frequency.value = 100;
    this.stOsc2 = c.createOscillator(); this.stOsc2.type = 'sine'; this.stOsc2.frequency.value = 200;
    const o2g = this.gain(0.35, whLp);
    this.stOsc.connect(whLp); this.stOsc2.connect(o2g); this.stOsc.start(); this.stOsc2.start();
    // compressão: um LFO que derruba o tom e o volume a cada pistão que comprime
    this.stLfo = c.createOscillator(); this.stLfo.type = 'sine'; this.stLfo.frequency.value = 8;
    this.stLfoA = this.gain(0.32); this.stLfo.connect(this.stLfoA); this.stLfoA.connect(this.stWhG.gain);
    this.stLfoF = this.gain(14); this.stLfo.connect(this.stLfoF); this.stLfoF.connect(this.stOsc.frequency);
    this.stLfoF2 = this.gain(28); this.stLfo.connect(this.stLfoF2); this.stLfoF2.connect(this.stOsc2.frequency);
    this.stLfo.start();
    this.stGear = this.gain(0, stLp);
    this.loop(white).connect(this.filt('bandpass', 850, 2.2, this.stGear));
    this.stBrush = this.gain(0, stLp);
    this.loop(white).connect(this.filt('bandpass', 3200, 1.2, this.stBrush));

    // bomba de combustível (escorva ao ligar a chave)
    this.pumpG = this.gain(0, this.bus);
    this.pumpOsc = c.createOscillator(); this.pumpOsc.type = 'square'; this.pumpOsc.frequency.value = 205;
    this.pumpOsc.connect(this.filt('bandpass', 620, 2.5, this.pumpG)); this.pumpOsc.start();

    // ventoinha do radiador
    this.fanG = this.gain(0, this.bus);
    this.loop(white).connect(this.filt('bandpass', 520, 0.8, this.fanG));

    // câmbio (zumbido de engrenagem com carga)
    this.gbG = this.gain(0, this.bus);
    this.gbOsc = c.createOscillator(); this.gbOsc.type = 'triangle'; this.gbOsc.frequency.value = 400;
    this.gbOsc.connect(this.filt('bandpass', 900, 1.5, this.gbG)); this.gbOsc.start();

    // vento e pneus
    this.windG = this.gain(0, this.bus);
    this.windF = this.filt('lowpass', 600, 0.6, this.windG);
    this.loop(white).connect(this.filt('highpass', 120, 0.6, this.windF));
    this.tireG = this.gain(0, this.bus);
    this.loop(brown).connect(this.filt('bandpass', 260, 0.9, this.tireG));
    this.white = white;
  }

  buildEngine() {
    const c = this.ctx;
    this.node = new AudioWorkletNode(c, 'engine-i4', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [3],
      processorOptions: { seed: 4242, cfg: this.cfg || undefined },
    });
    const sp = c.createChannelSplitter(3);
    this.node.connect(sp);
    // escape um pouco à direita (atrás), admissão e mecânica um pouco à esquerda (na frente)
    const mk = (ch, pan) => {
      const g = this.gain(1);
      sp.connect(g, ch);
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = pan; g.connect(p); p.connect(this.bus); } else g.connect(this.bus);
      return g;
    };
    this.exG = mk(0, 0.12);
    this.inG = mk(1, -0.18);
    this.meG = mk(2, -0.08);
    this.p = {};
    for (const [k] of this.node.parameters) this.p[k] = this.node.parameters.get(k);
    this.applyListen();
  }

  applyListen() {
    if (!this.exG) return;
    const r = this.listen === 'rider';
    this.set(this.exG.gain, r ? 0.62 : 1.0, 0.1);
    this.set(this.inG.gain, r ? 1.25 : 0.32, 0.1);
    this.set(this.meG.gain, r ? 0.9 : 0.3, 0.1);
  }

  // ---------- eventos ----------
  burst(f, q, dur, amp, type = 'bandpass', at = 0) {
    const c = this.ctx, t = this.now() + at;
    const s = c.createBufferSource(); s.buffer = this.white;
    const fl = this.filt(type, f, q); const g = this.gain(0);
    s.connect(fl); fl.connect(g); g.connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, this.rand() * 2); s.stop(t + dur + 0.05);
  }
  tone(f, dur, amp, type = 'sine', at = 0, f2) {
    const c = this.ctx, t = this.now() + at;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.gain(0); o.connect(g); g.connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  click(amp = 0.15) { this.burst(3200, 2, 0.03, amp); this.tone(1800, 0.02, amp * 0.4, 'square'); }
  clunk(amp = 0.5) { this.tone(95, 0.12, amp, 'sine', 0, 60); this.burst(700, 1.5, 0.07, amp * 0.6); this.burst(2400, 4, 0.04, amp * 0.25, 'bandpass', 0.005); }
  grind() { for (let i = 0; i < 5; i++) this.burst(1800 + this.rand() * 2000, 6, 0.05, 0.25, 'bandpass', i * 0.035); }
  // pedal de partida: baque do pé, catraca da engrenagem e a mola voltando
  kickSnd() {
    this.burst(260, 0.7, 0.12, 0.55, 'lowpass');
    this.tone(85, 0.14, 0.4, 'sine', 0, 55);
    for (let i = 0; i < 6; i++) this.burst(2600 + this.rand() * 900, 6, 0.018, 0.14 * (1 - i / 8), 'bandpass', 0.03 + i * 0.022);
    this.burst(1400, 3, 0.05, 0.12, 'bandpass', 0.36);
  }
  bang() { this.burst(300, 0.6, 0.6, 1.0, 'lowpass'); this.tone(70, 0.5, 0.8, 'sine', 0, 35); for (let i = 0; i < 8; i++) this.burst(2000 + this.rand() * 4000, 5, 0.15, 0.3, 'bandpass', 0.05 + i * 0.06); }

  resetFx() { this.prev = null; this.popEnv = 0; this.flap = 0; }
  flapVal(P) { return P.flap === 'open' ? 1 : P.flap === 'closed' ? 0 : this.flap; }

  // configuração do sintetizador para o motor atual
  engineCfg(P) {
    const E = profile(P), V = E.valve;
    return {
      ...E.snd, n: E.cyl, off: E.firing[P.crank] || Object.values(E.firing)[0],
      ivo: V.full.ivo + 720, ivc: V.full.ivc, evo: V.exh.evo, evc: V.exh.evc,
    };
  }

  // ---------- a cada quadro ----------
  update(st, P, dt) {
    if (!this.ctx) return;
    const vol = this.enabled ? this.volume : 0;
    this.set(this.master.gain, vol * 1.3, 0.05);

    const prev = this.prev;
    const E = profile(P);
    const cfgKey = P.engine + P.crank;
    if (cfgKey !== this.cfgKey) {
      this.cfgKey = cfgKey;
      this.cfg = this.engineCfg(P);
      if (this.node) this.node.port.postMessage({ cfg: this.cfg });
    }
    // eventos por mudança de estado
    if (prev) {
      if (st.key !== prev.key) this.click(0.18);
      if (st.run !== prev.run) this.click(0.12);
      if (st.snd.clunk) { this.clunk(st.v > 1 || st.rpm > 3000 ? 0.45 : 0.6); st.snd.clunk = 0; }
      if (st.snd.grind) { this.grind(); st.snd.grind = 0; }
      if (st.snd.bang) { this.bang(); st.snd.bang = 0; }
      if (st.snd.kick) { this.kickSnd(); st.snd.kick = 0; }
      // solenoide engatando (clack) e o pinhão soltando (clunk) ao parar de girar a partida
      if (st.starter && !prev.starter) { this.burst(700, 0.8, 0.06, 0.5, 'lowpass'); this.burst(2400, 3, 0.025, 0.25); this.tone(140, 0.07, 0.25, 'sine', 0, 90); }
      if (!st.starter && prev.starter) { this.burst(500, 0.9, 0.05, 0.3, 'lowpass', 0.01); this.burst(1800, 3, 0.03, 0.12, 'bandpass', 0.015); }
    }

    // motor de partida
    const st_on = st.starter, v2 = E.cyl === 2;
    const crank = Math.max(0, st.rpm);
    this.set(this.stG.gain, st_on ? (v2 ? 0.15 : 0.12) : 0, st_on ? 0.015 : 0.12);
    // tom do motor elétrico: sobe com a rotação; ao soltar ele desacelera em vez de sumir de uma vez
    const f0 = (v2 ? 70 : 95) + crank * (v2 ? 0.45 : 0.55);
    this.set(this.stOsc.frequency, st_on ? f0 : f0 * 0.5, st_on ? 0.05 : 0.15);
    this.set(this.stOsc2.frequency, st_on ? f0 * 2 : f0, st_on ? 0.05 : 0.15);
    // compressões por segundo: 4 em linha = 2 por volta; V-Twin = 1 por volta (e bem mais pesadas)
    const comp = Math.max(2, crank / 60 * (v2 ? 1 : 2));
    this.set(this.stLfo.frequency, comp, 0.05);
    this.set(this.stLfoA.gain, v2 ? 0.42 : 0.3, 0.1);
    this.set(this.stGear.gain, st_on ? (v2 ? 0.26 : 0.17) : 0, 0.03);
    this.set(this.stBrush.gain, st_on ? 0.018 : 0, 0.03);
    // bomba, ventoinha
    const priming = st.key && st.pumpT > 0;
    this.set(this.pumpG.gain, priming ? 0.05 : 0, 0.05);
    this.set(this.fanG.gain, st.fan && st.key ? 0.06 : 0, 0.4);

    // vento, pneus, câmbio
    const v = st.v, rider = this.listen === 'rider';
    this.set(this.windG.gain, Math.min(0.5, (v / 70) ** 2 * (rider ? 0.5 : 0.1)), 0.1);
    this.set(this.windF.frequency, 300 + v * 30, 0.1);
    this.set(this.tireG.gain, Math.min(0.2, v / 80 * 0.12), 0.1);
    const outRev = st.gear ? st.rpm / 60 : 0;
    this.set(this.gbOsc.frequency, Math.max(40, outRev * 19), 0.03);
    this.set(this.gbG.gain, st.gear && st.locked ? Math.min(0.03, Math.abs(st.Tc) / 120 * 0.03) : 0, 0.05);

    // garagem ↔ ar livre
    this.set(this.wet.gain, v > 3 ? 0.05 : 0.16, 0.5);

    // ---------- worklet do motor ----------
    if (this.node) {
      const p = this.p;
      const firing = st.running && st.primed && st.key && st.run && !st.broken;
      const cutFrac = st.snd.tAcc > 0 ? st.snd.cutAcc / st.snd.tAcc : 0;
      st.snd.cutAcc = 0; st.snd.tAcc = 0;
      let fuel = firing ? Math.max(0, 1 - cutFrac) * Math.min(1, st.comb > 0 || st.cut.any ? 1 : 0) : 0;
      // girando sem pegar: algumas compressões explodem (tossidas) antes de o motor pegar
      if (!st.running && st.key && st.run && !st.broken && st.rpm > 60) fuel = Math.min(0.9, st.crankP * 0.9);
      if (firing && st.lambda > 1.3) fuel *= Math.max(0, 1 - (st.lambda - 1.3) * 3);
      // pipocos: depois de fechar o acelerador vindo de carga alta, no corte de giro e no quickshift
      if (prev && prev.tps > 0.4 && st.tps < 0.1 && st.rpm > 0.3 * E.limit) this.popEnv = 1;
      const o = exhaustOpen(P), popBase = 0.025 + 0.2 * o * o + (P.muffler === false ? 0.08 : 0);
      this.popEnv = Math.max(0, this.popEnv - dt / (1.4 + 0.8 * o));
      const rich = st.lambda < 0.92 ? 1.6 : 1;
      let pop = 0;
      if (firing) {
        if (st.cut.decel) pop = popBase * (0.25 + this.popEnv) * rich;
        if (st.cut.lim) pop = Math.max(pop, popBase * 1.4 + 0.04);
        if (st.cut.qs > 0) pop = 0.55;
      }
      this.flap += ((st.rpm > E.snd.flapRpm && st.tps > 0.3 ? 1 : 0) - this.flap) * (1 - Math.exp(-dt / 0.25));
      const load = Math.min(1.1, Math.max(0, st.pr) * 1.04);
      const cold = Math.max(0, Math.min(1, (60 - st.temp.coolant) / 40));
      this.set(p.rpm, st.rpm, 0.012);
      this.set(p.load, load, 0.012);
      p.fuel.setValueAtTime(fuel, this.now());
      this.set(p.throttle, st.tps, 0.02);
      this.set(p.cam, st.cam, 0.05);
      this.set(p.egt, st.temp.egt, 0.3);
      this.set(p.knock, st.knock, 0.02);
      this.set(p.float, st.float, 0.02);
      p.pop.setValueAtTime(pop, this.now());
      this.set(p.flap, this.flapVal(P), 0.05);
      p.misfire.setValueAtTime(firing ? P.failSpark : 0, this.now());
      this.set(p.idleRough, 0.1 + 0.12 * cold + (P.failFilter ? 0.04 : 0), 0.2);
      this.set(p.open, P.muffler === false ? 1.3 : o, 0.08);
      this.set(p.pipeLen, P.pipeLen ?? 1, 0.08);
    }

    this.prev = { key: st.key, run: st.run, starter: st.starter, tps: st.tps, gear: st.gear };
  }

  // nível do mix (RMS e pico) para conferir saturação
  level() {
    if (!this.meter) return null;
    const a = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(a);
    let s = 0, pk = 0;
    for (const v of a) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
    return { rms: Math.sqrt(s / a.length), peak: pk };
  }
}
