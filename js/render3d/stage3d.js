// Base das vistas 3D: carrega o Three.js só quando a vista é aberta, cria cena, câmera, luzes e a órbita
// (arrastar gira, rolar aproxima). Cada motor tem o seu construtor (ex.: boxer3d.js), que recebe um Stage3D,
// monta as peças em `stage.root` e implementa update(st, P, dt, vib).
// Unidades: milímetros. Eixos: Z ao longo do virabrequim, Y para cima.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
let THREE = null;
export async function loadThree() {
  if (!THREE) THREE = await import(THREE_URL);
  return THREE;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Stage3D {
  constructor(box, T, o = {}) {
    this.T = T;
    this.box = box;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    box.insertBefore(this.canvas, box.firstChild);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(o.fov ?? 30, 1, 20, 12000);
    this.orb = { az: o.az ?? 0.65, el: o.el ?? 0.42, dist: o.dist ?? 1700, min: o.min ?? 500, max: o.max ?? 4000, target: new T.Vector3(...(o.target || [0, 0, 0])) };
    this.home = { az: this.orb.az, el: this.orb.el, dist: this.orb.dist };
    this.auto = true;
    this.idle = 9;
    // luz: céu/chão + três direcionais (principal, preenchimento e contraluz)
    this.scene.add(new T.HemisphereLight(0xdfeaff, 0x1a2230, 1.25));
    const mk = (c, i, x, y, z) => { const l = new T.DirectionalLight(c, i); l.position.set(x, y, z); this.scene.add(l); return l; };
    mk(0xffffff, 2.0, 600, 900, 700);
    mk(0x9fc4ff, 0.9, -800, 300, 200);
    mk(0xffd9b0, 0.8, 200, -300, -900);
    this.root = new T.Group();
    this.scene.add(this.root);
    this.bindOrbit();
    this.w = 0; this.h = 0;
  }

  // ---------- materiais e formas prontas ----------
  metal(color, rough = 0.45, metal = 0.45) { return new this.T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
  glass(color, opacity = 0.14) { return new this.T.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, transparent: true, opacity, depthWrite: false, side: this.T.DoubleSide }); }
  // cilindros já deitados no eixo pedido
  cyl(axis, r, len, seg = 32, open = false) {
    const g = new this.T.CylinderGeometry(r, r, len, seg, 1, open);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    return g;
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new this.T.Mesh(geo, mat);
    m.position.set(x, y, z);
    (parent || this.root).add(m);
    return m;
  }
  // caixa translúcida com as arestas marcadas (para carcaças: dá para ver o que há dentro)
  shell(w, h, d, mat, parent, x = 0, y = 0, z = 0, edge = 0x7e8ea0) {
    const T = this.T, geo = new T.BoxGeometry(w, h, d);
    const m = this.mesh(geo, mat, parent, x, y, z);
    this.edges(m, edge);
    return m;
  }
  edges(m, color = 0x7e8ea0, angle = 25) {
    const T = this.T;
    m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, angle), new T.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
    return m;
  }
  tube(points, r, mat, parent, seg = 28) {
    const T = this.T, c = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
    return this.mesh(new T.TubeGeometry(c, seg, r, 14, false), mat, parent);
  }
  curve(points) { return new this.T.CatmullRomCurve3(points.map((p) => new this.T.Vector3(...p)), false, 'centripetal'); }
  tubeOn(curve, r, mat, parent, seg = 40, radial = 18) { return this.mesh(new this.T.TubeGeometry(curve, seg, r, radial, false), mat, parent); }
  // tronco de cone ao longo de Z (r0 em z menor, r1 em z maior): junções e bocais
  cone(r0, r1, len, seg = 28, open = false) {
    const g = new this.T.CylinderGeometry(r1, r0, len, seg, 1, open);
    g.rotateX(Math.PI / 2);
    return g;
  }
  // perfil 2D (função que desenha num Shape, em x–y) esticado ao longo de Z e centrado; mirror espelha em x
  extrude(draw, depth, bevel = 3, mirror = false) {
    const T = this.T, sh = new T.Shape();
    draw(sh);
    const g = new T.ExtrudeGeometry(sh, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -(depth - 2 * bevel) / 2);
    if (mirror) { g.scale(-1, 1, 1); g.computeVertexNormals(); }
    return g;
  }
  // mancha macia (gás, vapor, brilho): um sprite com textura em degradê circular
  softTex() {
    if (this._soft) return this._soft;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return (this._soft = new this.T.CanvasTexture(cv));
  }
  puff(color, parent, glow = false, through = true) {
    const T = this.T;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: this.softTex(), color, transparent: true, opacity: 0, depthWrite: false, depthTest: !through, blending: glow ? T.AdditiveBlending : T.NormalBlending }));
    sp.renderOrder = 5;
    (parent || this.root).add(sp);
    return sp;
  }
  // textura de riscos (colmeia de radiador, aletas)
  linesTex(n = 64, vertical = true) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#5a6672';
    for (let i = 0; i < n; i++) { const p = i * 256 / n; if (vertical) c.fillRect(p, 0, 256 / n * 0.42, 256); else c.fillRect(0, p, 256, 256 / n * 0.42); }
    return new this.T.CanvasTexture(cv);
  }
  // etiqueta que sempre olha para a câmera
  label(text, size = 46, color = '#e6edf3') {
    const T = this.T, cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#0b1118cc'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
    c.strokeStyle = color; c.lineWidth = 5; c.stroke();
    c.fillStyle = color; c.font = '800 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, 64, 70);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(size, size, 1);
    sp.renderOrder = 10;
    return sp;
  }

  // ---------- órbita ----------
  bindOrbit() {
    const c = this.canvas, o = this.orb;
    let id = null, lx = 0, ly = 0;
    c.style.touchAction = 'none';
    c.style.cursor = 'grab';
    c.addEventListener('pointerdown', (e) => { id = e.pointerId; c.setPointerCapture(id); lx = e.clientX; ly = e.clientY; c.style.cursor = 'grabbing'; this.idle = 0; });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const k = 0.0065 / Math.max(0.3, this.cssScale || 1);
      o.az -= (e.clientX - lx) * k;
      o.el = clamp(o.el + (e.clientY - ly) * k, -1.35, 1.45);
      lx = e.clientX; ly = e.clientY; this.idle = 0;
    });
    const up = (e) => { if (e.pointerId === id) { id = null; c.style.cursor = 'grab'; } };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); o.dist = clamp(o.dist * Math.exp(e.deltaY * 0.0012), o.min, o.max); this.idle = 0; }, { passive: false });
    c.addEventListener('dblclick', () => Object.assign(o, this.home));
  }
  zoom(f) { this.orb.dist = clamp(this.orb.dist * f, this.orb.min, this.orb.max); this.idle = 0; }

  resize() {
    const w = this.box.clientWidth, h = this.box.clientHeight;
    if (!w || !h || (w === this.w && h === this.h)) return;
    this.w = w; this.h = h;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    // em tela estreita (celular em pé) afasta a câmera para o motor caber na largura
    // em tela larga (a cena inteira no 16:9) sobra largura: chega mais perto
    this.fit = w / h < 1 ? 1 / Math.max(0.55, w / h) : w / h > 1.4 ? 0.74 : 1;
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    this.resize();
    const o = this.orb;
    this.idle += dt;
    if (this.auto && this.idle > 3) o.az += dt * 0.12;
    const d = o.dist * (this.fit || 1), ce = Math.cos(o.el);
    this.camera.position.set(o.target.x + d * ce * Math.sin(o.az), o.target.y + d * Math.sin(o.el), o.target.z + d * ce * Math.cos(o.az));
    this.camera.lookAt(o.target);
    this.renderer.render(this.scene, this.camera);
  }
}
