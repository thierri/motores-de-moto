// Motor do modo apresentação (o vídeo e o ?apresentacao): cenas como dados.
//   prep    estado inicial: { engine, running, warm, key, choke, gear, P: {...}, tab }
//   moves   comandos com rampa: [t, duração, { grip, clutch, brake, start }]
//   events  ações num instante: [t, (st, P, app) => …]
//   views   região da cena: [t, 'motor' | 'dentro' | 'escape' | null]; no 16:9 vira zoom, no 9:16 vira aba
//   spots   holofote: [t, 'data-spot' | { sel } | { row: '#idDoParâmetro' } | null]
//   focuses peças em destaque no desenho (o resto escurece): [t, ['carb', 'slide']]
//   notes   legenda (só no 16:9): [t, 'texto']
//   drawer  gaveta de parâmetros: [t, true | false]
//   link    selo com o link: [t0, t1]
// Chaves com sufixo 916 (spots916, views916…) valem no formato 9:16.
import { SITE_LINK } from '../config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lastAt = (list, t) => { let v; if (list) for (const [ti, x] of list) if (ti <= t) v = x; return v; };

// zoom do 16:9 em cada região (mesma proporção da cena, 1400 × 784)
const ZOOM = {
  motor: [0, 0, 1400, 784],
  dentro: [702, 0, 698, 390.9],
  escape: [560, 313.6, 840, 470.4],
  cyl: [-10, 50, 860, 481.6],
};

export class Presentation {
  constructor(app, scenes) {
    this.app = app;
    this.scenes = scenes;
    this.active = false;
    this.i = 0;
    this.t = 0;
    this.auto = false;
    this.paused = false;
    this.e = {
      cap: document.getElementById('caption'), spot: document.getElementById('spot'), link: document.getElementById('linkBadge'),
      hint: document.getElementById('presHint'),
    };
    this.hintT = 0;
    this.keys();
  }

  get sc() { return this.scenes[this.i]; }
  opt(k) { const s = this.sc; return this.app.fmt === 'f916' && s[k + '916'] !== undefined ? s[k + '916'] : s[k]; }

  start(i = 0) {
    this.active = true;
    this.app.stage.classList.add('pres');
    this.go(i);
    this.showHint();
  }

  stop() {
    this.active = false;
    const a = this.app;
    a.stage.classList.remove('pres');
    a.controls.script = null;
    for (const k of ['cap', 'spot', 'link', 'hint']) this.e[k].classList.remove('show');
    a.scene.focus(null);
    a.scene.setCam(null);
    a.showDrawer(false);
    a.st.forceP = null; a.st.visRpm = null;
  }

  go(i) {
    this.i = clamp(i, 0, this.scenes.length - 1);
    const sc = this.sc, a = this.app;
    this.t = 0;
    this.fired = new Set();
    this.lastNote = undefined;
    this.lastSpot = undefined;
    this.lastFocus = undefined;
    this.lastView = undefined;
    this.lastDrawer = undefined;
    this.spotRect = null;
    this.cam = null;
    if (a.onSceneStart) a.onSceneStart(this.i);
    a.prepScene(sc.prep || {});
    a.controls.script = {};
    a.scene.focus(null);
    a.scene.setCam(null);
    a.showDrawer(false);
    a.info.show(null, a.st, a.P);
    this.caption(sc.title, '');
    this.update(0);
    a.resetFx();
  }

  // legenda por cima do quadro "Como usar" (16:9). No vídeo em pé não há lugar: a narração diz o mesmo.
  caption(title, text) {
    const c = this.e.cap, a = this.app;
    const show = a.fmt !== 'f916' && (text || title);
    c.classList.toggle('show', !!show);
    if (!show) return;
    if (title !== undefined) c.querySelector('.ct').textContent = title;
    c.querySelector('.cx').innerHTML = text || '';
    const r = this.rectOf({ sel: '#info', pad: 0 });
    if (r) Object.assign(c.style, { left: `${r[0]}px`, top: `${r[1]}px`, width: `${r[2]}px`, height: `${r[3]}px` });
  }

  // avança o roteiro (dt = tempo do roteiro; 0 enquanto o vídeo espera a fala)
  update(dt) {
    if (!this.active) return;
    const sc = this.sc, a = this.app;
    const t0 = this.t;
    if (!this.paused) this.t += dt;
    const t = this.t;

    // comandos: rampas de 0,15 s, como a mão do piloto
    const cmd = {};
    for (const [s0, dur, c] of sc.moves || []) {
      const r = c.ramp ?? 0.15;
      const k = clamp((t - s0) / r, 0, 1) * clamp((s0 + dur - t) / r, 0, 1);
      if (t < s0 || t > s0 + dur) continue;
      for (const key in c) {
        if (key === 'ramp') continue;
        if (typeof c[key] === 'boolean') cmd[key] = cmd[key] || c[key];
        else cmd[key] = Math.max(cmd[key] || 0, c[key] * k);
      }
    }
    a.controls.script = cmd;

    for (let k = 0; k < (sc.events || []).length; k++) {
      const [te, fn] = sc.events[k];
      if (te <= t && !this.fired.has(k)) { this.fired.add(k); fn(a.st, a.P, a); }
    }

    const note = lastAt(this.opt('notes'), t);
    if (note !== this.lastNote) { this.lastNote = note; this.caption(sc.title, note || ''); }

    const f = lastAt(this.opt('focuses'), t);
    if (f !== this.lastFocus) { this.lastFocus = f; a.scene.focus(f && f.length ? f : null); }

    const dr = lastAt(this.opt('drawer'), t) ?? false;
    if (dr !== this.lastDrawer) { this.lastDrawer = dr; a.showDrawer(dr); }

    // região da cena: zoom suave no 16:9, aba no 9:16
    const v = lastAt(this.opt('views'), t) ?? null;
    if (a.fmt === 'f916') {
      if (v !== this.lastView) { this.lastView = v; a.scene.setTab(v && v !== 'cyl' ? v : 'motor'); a.buildTabs(); }
    } else {
      const target = ZOOM[v || 'motor'];
      if (!this.cam) this.cam = target.slice();
      else { const k = dt > 0 ? 1 - Math.exp(-3.2 * dt) : 0; for (let i = 0; i < 4; i++) this.cam[i] += (target[i] - this.cam[i]) * k; }
      const full = this.cam.every((x, i) => Math.abs(x - ZOOM.motor[i]) < 0.5);
      a.scene.setCam(full ? null : this.cam);
    }

    this.spot(lastAt(this.opt('spots'), t) ?? null, dt);

    const L = sc.link;
    this.e.link.classList.toggle('show', !!L && t >= L[0] && t <= L[1]);
    if (L) this.e.link.innerHTML = `<small>Experimente você mesmo</small>${SITE_LINK}`;

    if (!a.video) { this.hintT -= dt; this.e.hint.classList.toggle('show', this.hintT > 0); }
    if (this.auto && t >= sc.duration && t0 < sc.duration && this.i < this.scenes.length - 1) this.go(this.i + 1);
  }

  rectOf(target) {
    const a = this.app, k = a.k;
    const sr = a.stage.getBoundingClientRect();
    const fromEl = (e, pad = 8) => {
      const r = e.getBoundingClientRect();
      if (!r.width) return null;
      return [(r.left - sr.left) / k - pad, (r.top - sr.top) / k - pad, r.width / k + 2 * pad, r.height / k + 2 * pad];
    };
    if (Array.isArray(target)) return target;
    if (typeof target === 'string') {
      const map = { scene: '#sceneWrap', panel: '#panel', controls: '#controls', topbar: '#topbar', drawer: '#drawer' };
      const e = a.stage.querySelector(map[target] || `[data-spot="${target}"]`) || a.stage.querySelector(target);
      return e ? fromEl(e, map[target] ? -4 : 8) : null;
    }
    if (target && target.row) {
      const e = a.stage.querySelector(target.row);
      const row = e && (e.closest('.prow') || e);
      if (!row) return null;
      // rola a gaveta para a linha ficar à vista
      const dr = document.getElementById('drawer');
      const want = row.offsetTop - dr.clientHeight * 0.35;
      if (Math.abs(dr.scrollTop - want) > 2) dr.scrollTop = Math.max(0, want);
      return fromEl(row, 6);
    }
    if (target && target.sel) {
      const e = a.stage.querySelectorAll(target.sel)[target.i || 0];
      return e ? fromEl(e, target.pad ?? 8) : null;
    }
    return null;
  }

  spot(target, dt) {
    const s = this.e.spot;
    if (!target) { s.classList.remove('show'); this.spotRect = null; this.lastSpot = null; return; }
    const r = this.rectOf(target);
    if (!r) { s.classList.remove('show'); return; }
    if (!this.spotRect || !this.lastSpot) this.spotRect = r.slice();
    else {
      const k = dt > 0 ? 1 - Math.exp(-9 * dt) : 0;
      for (let i = 0; i < 4; i++) this.spotRect[i] += (r[i] - this.spotRect[i]) * k;
    }
    this.lastSpot = target;
    const [x, y, w, h] = this.spotRect;
    Object.assign(s.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    s.classList.add('show');
  }

  showHint() {
    if (this.app.video) return;
    this.e.hint.innerHTML = this.app.fmt === 'f916'
      ? 'Toque à direita: próxima cena · à esquerda: anterior · segure 1 s: sair'
      : '<kbd>→</kbd> próxima <kbd>←</kbd> anterior <kbd>R</kbd> repetir <kbd>A</kbd> automático <kbd>P</kbd> pausa <kbd>Esc</kbd> sair';
    this.hintT = 3;
  }

  keys() {
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const k = e.code;
      if (['ArrowRight', 'PageDown'].includes(k)) this.go(this.i + 1);
      else if (['ArrowLeft', 'PageUp'].includes(k)) this.go(this.i - 1);
      else if (k === 'KeyR') this.go(this.i);
      else if (k === 'KeyA') { this.auto = !this.auto; this.flash(this.auto ? 'Automático ligado' : 'Automático desligado'); }
      else if (k === 'KeyP') { this.paused = !this.paused; this.flash(this.paused ? 'Pausado' : 'Continuando'); }
      else if (k === 'Escape') this.stop();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, { capture: true });
    let down = 0, x = 0;
    const st = this.app.stage;
    st.addEventListener('pointerdown', (e) => { if (this.active) { down = performance.now(); x = e.clientX; } });
    st.addEventListener('pointerup', (e) => {
      if (!this.active || !down) return;
      const held = performance.now() - down;
      down = 0;
      if (e.pointerType === 'mouse') return;
      if (held > 900) { this.stop(); return; }
      const r = st.getBoundingClientRect();
      if (x > r.left + r.width / 3) this.go(this.i + 1); else this.go(this.i - 1);
    });
  }

  flash(s) {
    if (this.app.video) return;
    this.e.hint.textContent = s;
    this.hintT = 1.5;
  }
}
