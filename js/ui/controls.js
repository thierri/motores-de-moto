// Comandos do piloto: chave, corta-corrente, partida, manopla do acelerador, câmbio, embreagem, freio,
// modo de pilotagem e posição de escuta. Teclado e controle de videogame escrevem no mesmo lugar.
// O roteiro da apresentação pode escrever em `script` (sobrepõe o usuário).
import { MODES } from '../config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Controls {
  constructor(root, app) {
    this.app = app;
    this.root = root;
    this.user = { grip: 0, start: false, clutch: false, brake: false };
    this.kb = { up: false, wot: false, start: false, clutch: false, brake: false };
    this.lock = false;
    this.lockVal = 0;
    this.grip = 0;
    this.clutch = 0;
    this.brake = 0;
    this.script = null;
    this.pad = null;
    root.innerHTML = `
      <div class="cgrp ign" data-spot="ign">
        <div class="cb"><button class="key" id="btnKey" aria-label="Chave"><span class="kh"></span></button><label>Chave <kbd>I</kbd></label></div>
        <div class="cb"><button class="kill" id="btnKill" aria-label="Corta-corrente"><span>RUN</span></button><label>Corta-corrente <kbd>K</kbd></label></div>
        <div class="cb"><button class="startb" id="btnStart" aria-label="Partida"><span>START</span></button><label>Partida <kbd>Enter</kbd></label></div>
      </div>
      <div class="grip" id="grip" data-spot="grip">
        <div class="gl"><b>Acelerador</b><span id="gripV">0%</span></div>
        <div class="track" id="gripTrack">
          <div class="fill" id="gripFill"></div>
          <div class="hand" id="gripHand"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="gfoot">
          <span class="keys"><kbd>↑</kbd> abre aos poucos · <kbd>Espaço</kbd> tudo · arraste a manopla</span>
          <button class="tg" id="gripLock">Manter posição</button>
        </div>
      </div>
      <div class="box" data-spot="gearbox">
        <div class="gl"><b>Câmbio</b><span id="gearV">N</span></div>
        <div class="gearrow">
          <button class="gb" id="gDown">▼</button><button class="gb n" id="gN">N</button><button class="gb" id="gUp">▲</button>
        </div>
        <div class="gearrow">
          <button class="hold" id="btnClutch">Embreagem</button><button class="hold" id="btnBrake">Freio</button>
        </div>
        <div class="keys"><kbd>Q</kbd>/<kbd>E</kbd> desce/sobe · <kbd>N</kbd> neutro · <kbd>C</kbd> embreagem · <kbd>S</kbd> freio</div>
      </div>
      <div class="box" data-spot="mode">
        <div class="gl"><b>Modo de pilotagem</b><kbd>M</kbd></div>
        <div class="seg" id="modeSeg">${Object.entries(MODES).map(([k, m]) => `<button data-v="${k}">${m.name}</button>`).join('')}</div>
        <div class="gl" style="margin-top:6px"><b>Ouvir de</b><kbd>O</kbd></div>
        <div class="seg" id="listenSeg"><button data-v="rear">Atrás da moto</button><button data-v="rider">Piloto</button></div>
      </div>
      <div class="info" id="info"></div>`;
    const $ = (s) => root.querySelector(s);
    this.e = {
      key: $('#btnKey'), kill: $('#btnKill'), start: $('#btnStart'), track: $('#gripTrack'), fill: $('#gripFill'), hand: $('#gripHand'),
      gv: $('#gripV'), lock: $('#gripLock'), gear: $('#gearV'), clutch: $('#btnClutch'), brake: $('#btnBrake'),
      mode: $('#modeSeg'), listen: $('#listenSeg'),
    };
    this.e.key.addEventListener('click', () => app.setKey(!app.st.key));
    this.e.kill.addEventListener('click', () => app.setRun(!app.st.run));
    this.hold(this.e.start, (v) => (this.user.start = v));
    this.hold(this.e.clutch, (v) => (this.user.clutch = v));
    this.hold(this.e.brake, (v) => (this.user.brake = v));
    $('#gUp').addEventListener('click', () => app.shift(1));
    $('#gDown').addEventListener('click', () => app.shift(-1));
    $('#gN').addEventListener('click', () => app.shift(0));
    this.e.lock.addEventListener('click', () => this.setLock(!this.lock));
    this.e.mode.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) app.setMode(b.dataset.v); });
    this.e.listen.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) app.setListen(b.dataset.v); });
    this.gripDrag();
    this.keys();
  }

  hold(btn, set) {
    const on = (e) => { e.preventDefault(); set(true); btn.classList.add('on'); };
    const off = () => { set(false); btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, off);
  }

  setLock(v) {
    this.lock = v;
    this.lockVal = v ? this.grip : 0;
    this.e.lock.classList.toggle('on', v);
  }

  gripDrag() {
    const tr = this.e.track;
    let id = null;
    const move = (e) => {
      const r = tr.getBoundingClientRect();
      const v = clamp((e.clientX - r.left - r.height * 0.4) / (r.width - r.height * 0.8), 0, 1);
      this.user.grip = v;
      if (this.lock) this.lockVal = v;
    };
    tr.addEventListener('pointerdown', (e) => { id = e.pointerId; tr.setPointerCapture(id); this.dragging = true; move(e); });
    tr.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const up = (e) => { if (e.pointerId === id) { id = null; this.dragging = false; this.user.grip = 0; } };
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
    tr.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.lock) this.setLock(true);
      this.lockVal = clamp(this.lockVal - e.deltaY * 0.0012, 0, 1);
    }, { passive: false });
  }

  keys() {
    const map = { ArrowUp: 'up', KeyW: 'up', Space: 'wot', Enter: 'start', KeyC: 'clutch', KeyS: 'brake', ArrowDown: 'brake' };
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (this.app.pres && this.app.pres.active) return;
      const k = map[e.code];
      if (k) { this.kb[k] = true; e.preventDefault(); return; }
      if (e.repeat) return;
      if (e.code === 'KeyI') this.app.setKey(!this.app.st.key);
      else if (e.code === 'KeyK') this.app.setRun(!this.app.st.run);
      else if (e.code === 'KeyE' || e.code === 'PageUp') this.app.shift(1);
      else if (e.code === 'KeyQ' || e.code === 'PageDown') this.app.shift(-1);
      else if (e.code === 'KeyN') this.app.shift(0);
      else if (e.code === 'KeyM') this.app.cycleMode();
      else if (e.code === 'KeyO') this.app.setListen(this.app.sound.listen === 'rear' ? 'rider' : 'rear');
      else if (e.code === 'KeyL') this.setLock(!this.lock);
    });
    window.addEventListener('keyup', (e) => { const k = map[e.code]; if (k) this.kb[k] = false; });
    window.addEventListener('blur', () => { for (const k in this.kb) this.kb[k] = false; });
  }

  readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find((x) => x && x.connected);
    if (!p) { this.pad = null; return; }
    const b = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
    const prev = this.pad || {};
    const cur = { rt: b(7), lt: b(6), a: b(0) > 0.5, x: b(2) > 0.5, rb: b(5) > 0.5, lb: b(4) > 0.5, y: b(3) > 0.5, bb: b(1) > 0.5 };
    if (cur.rb && !prev.rb) this.app.shift(1);
    if (cur.lb && !prev.lb) this.app.shift(-1);
    if (cur.y && !prev.y) this.app.setKey(!this.app.st.key);
    if (cur.bb && !prev.bb) this.app.shift(0);
    this.pad = cur;
  }

  resetFx() { this.grip = 0; this.clutch = 0; this.brake = 0; }

  // escreve os comandos no estado
  apply(st, P, dt) {
    if (!this.app.video) this.readPad();
    const pad = this.pad || {};
    const s = this.script;
    // manopla: teclado abre aos poucos, espaço abre tudo; a mola fecha ao soltar
    let target = Math.max(this.user.grip, this.lock ? this.lockVal : 0, pad.rt || 0);
    if (this.kb.wot) target = 1;
    if (this.kb.up) this.kbGrip = Math.min(1, (this.kbGrip || 0) + dt / 0.35);
    else this.kbGrip = Math.max(0, (this.kbGrip || 0) - dt / 0.08);
    target = Math.max(target, this.kbGrip);
    if (s && s.grip != null) target = s.grip;
    const rate = target > this.grip ? 1 / 0.05 : 1 / 0.07;
    this.grip += clamp(target - this.grip, -rate * dt, rate * dt);
    st.input.grip = this.grip;
    // embreagem: puxa rápido, solta progressivamente (dá para sair com a moto)
    let cl = this.user.clutch || this.kb.clutch || pad.x ? 1 : 0;
    if (s && s.clutch != null) cl = s.clutch;
    this.clutch = cl > this.clutch ? Math.min(cl, this.clutch + dt / 0.08) : Math.max(cl, this.clutch - dt / 0.7);
    st.input.clutch = this.clutch;
    let br = Math.max(this.user.brake || this.kb.brake ? 1 : 0, pad.lt || 0);
    if (s && s.brake != null) br = s.brake;
    this.brake += (br - this.brake) * (1 - Math.exp(-dt / 0.08));
    st.input.brake = this.brake;
    st.input.start = !!(this.user.start || this.kb.start || pad.a || (s && s.start));
  }

  render(st, P) {
    const e = this.e;
    e.key.classList.toggle('on', st.key);
    e.kill.classList.toggle('stop', !st.run);
    e.kill.querySelector('span').textContent = st.run ? 'RUN' : 'STOP';
    e.start.classList.toggle('on', st.input.start);
    const g = this.grip;
    e.fill.style.width = `${(g * 100).toFixed(1)}%`;
    e.hand.style.left = `${(g * 100).toFixed(1)}%`;
    e.hand.style.transform = `translateX(-${(g * 100).toFixed(1)}%) rotate(${(g * 8).toFixed(1)}deg)`;
    e.gv.textContent = `${Math.round(g * 100)}% · borboleta ${Math.round(st.tps * 100)}%`;
    e.gear.textContent = st.gear === 0 ? 'N' : `${st.gear}ª`;
    e.clutch.classList.toggle('on', st.input.clutch > 0.5);
    e.brake.classList.toggle('on', st.input.brake > 0.5);
    e.mode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === P.mode));
    e.listen.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.app.sound.listen));
  }
}
