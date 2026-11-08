import { DEFAULTS_BY, ENGINES, MODES } from './config.js';
import { createState, step, shift, kick } from './sim/engine.js';
import { Scene } from './render/scene.js';
import { Panel } from './render/panel.js';
import { Controls } from './ui/controls.js';
import { Info } from './ui/info.js';
import { Params } from './ui/params.js';
import { Sound } from './audio/sound.js';

const qs = new URLSearchParams(location.search);
const VIDEO = qs.has('video') || window.__VIDEO_MODE === true;
const PHYS_DT = 1 / 240;
const clone = (o) => JSON.parse(JSON.stringify(o));
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ICON = {
  // silhuetas das motos (traço, cor do texto)
  sport: '<svg class="mi" viewBox="0 0 52 28"><circle cx="11" cy="21" r="6"/><circle cx="41" cy="21" r="6"/><path d="M11 21 L19 13 L28 12 L35 9 L46 13 L41 21 M19 13 L16 9 L23 7 L30 9 M35 9 L40 6 L44 7 M28 12 L33 18 L41 21"/></svg>',
  cruiser: '<svg class="mi" viewBox="0 0 52 28"><circle cx="10" cy="21" r="6"/><circle cx="43" cy="21" r="6"/><path d="M10 21 L17 15 L26 16 L29 13 L36 12 L43 21 M36 12 L33 4 L29 4 M17 15 L13 12 L21 11 M26 16 L30 21 L38 21"/></svg>',
  street: '<svg class="mi" viewBox="0 0 52 28"><circle cx="11" cy="21" r="5.5"/><circle cx="41" cy="21" r="5.5"/><path d="M11 21 L18 14 L29 13 L37 9 L41 21 M18 14 L15 11 L23 10 M23 10 Q28 7 32 10 M37 9 L35 5 L31 5 M29 13 L31 19 L41 21"/><circle cx="39" cy="9" r="1.8"/></svg>',
  snd: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M10.3 2h3.4l.5 2.6 2 .9 2.2-1.5 2.4 2.4-1.5 2.2.9 2 2.6.5v3.4l-2.6.5-.9 2 1.5 2.2-2.4 2.4-2.2-1.5-2 .9-.5 2.6h-3.4l-.5-2.6-2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2L2 13.7v-3.4l2.6-.5.9-2L4 5.6 6.4 3.2l2.2 1.5 2-.9z" fill="currentColor" fill-rule="evenodd"/><circle cx="12" cy="12" r="3.2" fill="#141f2b"/></svg>',
};

class App {
  constructor() {
    this.video = VIDEO;
    this.stage = document.getElementById('stage');
    if (VIDEO) this.stage.classList.add('video');
    const q = qs.get('motor');
    this.Ps = { i4: clone(DEFAULTS_BY.i4), v2: clone(DEFAULTS_BY.v2), cg: clone(DEFAULTS_BY.cg) };
    this.P = this.Ps[q === 'v2' || q === 'harley' ? 'v2' : q === 'cg' ? 'cg' : 'i4'];
    this.st = createState(this.P);
    this.acc = 0;
    this.pres = { active: false };

    this.buildTopbar();
    this.scene = new Scene(document.getElementById('scene'), document.getElementById('overlay'));
    this.panel = new Panel(document.getElementById('panel'));
    this.controls = new Controls(document.getElementById('controls'), this);
    this.info = new Info(document.getElementById('info'), document.getElementById('infoCard'));
    this.info.onClose = () => this.scene.setSel(null);
    this.params = new Params(document.getElementById('drawer'), this);
    this.sound = new Sound();
    this.toast = document.getElementById('toast');

    this.scene.onPick = (id) => { this.info.show(id, this.st, this.P); this.scene.setSel(id); };
    document.getElementById('scene').addEventListener('click', (e) => {
      if (!e.target.closest('[data-comp]') && !e.target.closest('[data-cyl]')) { this.info.show(null, this.st, this.P); this.scene.setSel(null); }
    });

    const fq = qs.get('fmt');
    this.forcedFmt = fq === '916' ? 'f916' : fq === '169' ? 'f169' : null;
    document.getElementById('sceneTabs').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { this.scene.setTab(b.dataset.v); this.buildTabs(); }
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && e.target.tagName !== 'INPUT') { this.forcedFmt = this.fmt === 'f916' ? 'f169' : 'f916'; this.layout(); }
    });
    this.layout();
    this.syncBrand();
    this.info.show(null, this.st, this.P);
    this.params.sync();
    window.addEventListener('resize', () => this.layout());

    if (!VIDEO) {
      const gate = document.getElementById('audioGate');
      gate.classList.add('show');
      const unlock = () => {
        this.sound.start();
        this.sound.resume();
        gate.classList.remove('show');
      };
      window.addEventListener('pointerdown', unlock, { capture: true });
      window.addEventListener('keydown', unlock, { capture: true });
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.tick(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    this.onSceneStart = (i) => { if (VIDEO) Math.random = mulberry32(1000 + i); };
  }

  buildTopbar() {
    const tb = document.getElementById('topbar');
    tb.innerHTML = `
      <div class="brand"><b id="brandT"></b><span id="brandS"></span></div>
      <div class="engsel" id="engSel" data-spot="engine">
        <button data-v="i4">${ICON.sport}<span>4 em linha</span></button>
        <button data-v="v2">${ICON.cruiser}<span>V-Twin</span></button>
        <button data-v="cg">${ICON.street}<span>CG 125</span></button>
      </div>
      <div class="sp"></div>
      <div class="legend">
        <span>pressão / temperatura</span><i class="grad"></i><span class="lo">baixa</span><span class="hi">alta</span>
      </div>
      <div class="sound" data-spot="sound"><button class="ic" id="btnSound" aria-label="Som">${ICON.snd}</button><input type="range" id="vol" min="0" max="1" step="0.01" value="0.8"></div>
      <button class="btn" id="btnParams" data-spot="params">${ICON.gear}Parâmetros</button>`;
    const $ = (s) => tb.querySelector(s);
    $('#btnSound').addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      $('#btnSound').innerHTML = this.sound.enabled ? ICON.snd : ICON.mute;
      $('#btnSound').classList.toggle('off', !this.sound.enabled);
    });
    $('#vol').addEventListener('input', (e) => (this.sound.volume = +e.target.value));
    $('#engSel').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.setEngine(b.dataset.v); });
    $('#btnParams').addEventListener('click', () => this.showDrawer(!document.getElementById('drawer').classList.contains('open')));
  }

  // formato: 16:9 (computador) ou 9:16 (celular em pé); ?fmt=916 força, a tecla F alterna
  layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const fmt = this.forcedFmt || (vh > vw * 1.05 ? 'f916' : 'f169');
    if (fmt !== this.fmt) {
      this.fmt = fmt;
      this.stage.classList.toggle('f169', fmt === 'f169');
      this.stage.classList.toggle('f916', fmt === 'f916');
      this.scene.setFormat(fmt);
    }
    const W = fmt === 'f916' ? 1080 : 1920, H = fmt === 'f916' ? 1920 : 1080, k = Math.min(vw / W, vh / H);
    this.k = k;
    this.stage.style.transform = `translate(${((vw - W * k) / 2).toFixed(1)}px, ${((vh - H * k) / 2).toFixed(1)}px) scale(${k})`;
  }

  buildTabs() {
    const v2 = this.P.engine === 'v2';
    const eng = this.P.engine;
    const tabs = [['motor', { i4: '4 cilindros', v2: 'V-Twin', cg: 'CG 125' }[eng]], ['dentro', { i4: 'Por dentro', v2: 'Ritmo', cg: 'Carburador' }[eng]], ['escape', 'Escape']];
    const box = document.getElementById('sceneTabs');
    const cur = this.scene.tab || 'motor';
    box.innerHTML = tabs.map(([k, n]) => `<button data-v="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('');
  }

  setLayers(o) {
    this.scene.setLayers(o);
    this.params.sync();
  }

  showDrawer(on) {
    document.getElementById('drawer').classList.toggle('open', on);
    if (on) this.params.sync();
  }

  // troca de motor: cada motor guarda os próprios parâmetros e começa desligado (chave desligada)
  setEngine(key) {
    if (!ENGINES[key] || key === this.P.engine) { this.syncBrand(); return; }
    this.P = this.Ps[key];
    this.st = createState(this.P);
    this.controls.user.grip = 0;
    this.controls.setLock(false);
    this.scene.setCyl(0);
    this.info.show(this.info.sel, this.st, this.P);
    this.params.sync();
    this.resetFx();
    this.syncBrand();
  }
  syncBrand() {
    const E = ENGINES[this.P.engine];
    document.getElementById('brandT').innerHTML = E.title;
    document.getElementById('brandS').textContent = E.sub;
    document.querySelectorAll('#engSel button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.P.engine));
    document.title = `${E.name} · simulador de motor`;
    this.buildTabs();
  }

  // ---------- ações do piloto ----------
  setKey(on) { this.st.key = on; }
  setRun(on) { this.st.run = on; }
  shift(dir) { shift(this.st, this.P, dir); }
  kick() { kick(this.st, this.P); }
  setChoke(on) { if (ENGINES[this.P.engine].carb) this.st.choke = on; }
  setMode(m) { if (MODES[m]) this.P.mode = m; }
  cycleMode() { const k = Object.keys(MODES); this.setMode(k[(k.indexOf(this.P.mode) + 1) % k.length]); }
  setListen(v) { this.sound.listen = v; this.sound.applyListen(); }

  reset(prep = {}) {
    const keep = { key: this.st.key, wasKey: this.st.key, primed: this.st.key, run: true };
    this.st = createState(this.P, { ...keep, ...prep });
    this.acc = 0;
    this.params.sync();
    this.resetFx();
  }
  defaults() { this.Ps[this.P.engine] = clone(DEFAULTS_BY[this.P.engine]); this.P = this.Ps[this.P.engine]; this.reset(); }

  resetFx() {
    this.scene.resetFx();
    this.panel.resetFx();
    this.controls.resetFx();
    this.sound.resetFx();
    this.acc = 0;
  }

  // ---------- um quadro ----------
  tick(dt, scriptDt = dt) {
    if (this.pres.active && this.pres.update) this.pres.update(scriptDt);
    this.controls.apply(this.st, this.P, dt);
    if (VIDEO) {
      const n = Math.round(dt / PHYS_DT);
      for (let i = 0; i < n; i++) step(this.st, this.P, PHYS_DT);
    } else {
      this.acc += dt;
      while (this.acc >= PHYS_DT) { step(this.st, this.P, PHYS_DT); this.acc -= PHYS_DT; }
    }
    this.scene.update(this.st, this.P, dt);
    this.panel.update(this.st, this.P, dt, this.scene.cyl);
    this.controls.render(this.st, this.P);
    this.info.render(this.st, this.P);
    this.sound.update(this.st, this.P, dt);
    const m = this.st.msgT > 0 ? this.st.msg : '';
    if (this.toast.textContent !== m) this.toast.textContent = m;
    this.toast.classList.toggle('show', !!m);
  }
}

const app = new App();
window.app = app;
window.sim = {
  get st() { return app.st; },
  get params() { return app.P; },
  scene: app.scene, panel: app.panel, controls: app.controls, sound: app.sound,
  get pres() { return app.pres; },
  reset: (...a) => app.reset(...a),
  tick: (dt, sdt) => app.tick(dt, sdt),
  resetFx: () => app.resetFx(),
  setFormat: (f) => { app.forcedFmt = f === '916' || f === 'f916' ? 'f916' : 'f169'; app.layout(); },
  setEngine: (k) => app.setEngine(k),
  video: VIDEO,
};
