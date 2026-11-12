// Vista 3D na cena: um botão "Ver em 3D" aparece nos motores que têm modelo 3D (por enquanto, o boxer).
// A vista ocupa a região do desenho do motor (a da esquerda; no 9:16, a aba do motor) e esconde o desenho 2D
// daquela região. O arrefecimento, o escape, o painel e o som continuam os mesmos.
// Para dar 3D a outro motor: escrever um construtor como o boxer3d.js e registrá-lo em MODELS.
import { loadThree, Stage3D } from './stage3d.js';

const MODELS = {
  b6: { name: 'O boxer em 3D', load: () => import('./boxer3d.js').then((m) => m.Boxer3D), cam: { az: -1.05, el: 0.38, dist: 2750, max: 6000, target: [0, -10, 40] } },
};

export class View3D {
  constructor(wrap, app) {
    this.app = app;
    this.on = false;
    this.made = {};
    this.btn = document.createElement('button');
    this.btn.id = 'btn3d';
    this.btn.className = 'btn';
    wrap.appendChild(this.btn);
    this.box = document.createElement('div');
    this.box.id = 'view3d';
    this.box.innerHTML = `
      <div class="v3bar"><b></b>
        <button class="tg on" data-a="xray">Raio-X</button><button class="tg on" data-a="auto">Girar sozinho</button>
        <button class="tg" data-a="out">−</button><button class="tg" data-a="in">+</button></div>
      <div class="v3hint">arraste para girar · role para aproximar · dois cliques voltam à posição inicial</div>
      <div class="v3msg"></div>`;
    wrap.appendChild(this.box);
    this.msg = this.box.querySelector('.v3msg');
    this.title = this.box.querySelector('.v3bar b');
    this.btn.addEventListener('click', () => this.toggle());
    this.box.querySelector('.v3bar').addEventListener('click', (e) => {
      const b = e.target.closest('button'), cur = this.cur;
      if (!b || !cur) return;
      const a = b.dataset.a;
      if (a === 'xray') { cur.model.setXray(!cur.model.xray); b.classList.toggle('on', cur.model.xray); }
      else if (a === 'auto') { cur.stage.auto = !cur.stage.auto; b.classList.toggle('on', cur.stage.auto); }
      else cur.stage.zoom(a === 'in' ? 0.85 : 1.18);
    });
  }

  async toggle() {
    this.on = !this.on;
    const key = this.app.P.engine, M = MODELS[key];
    if (!this.on || !M || this.made[key] || this.loading) return;
    this.loading = true;
    this.msg.textContent = 'Carregando o 3D…';
    try {
      const T = await loadThree(), Cls = await M.load();
      const stage = new Stage3D(this.box, T, M.cam);
      this.made[key] = { stage, model: new Cls(stage) };
      this.msg.textContent = '';
    } catch (e) {
      console.error('3D', e);
      this.msg.textContent = 'Não consegui carregar o 3D (ele precisa de internet na primeira vez).';
      this.on = false;
    }
    this.loading = false;
  }

  update(st, P, dt) {
    const app = this.app, key = P.engine, M = MODELS[key];
    const here = !!M && (app.fmt !== 'f916' || (app.scene.tab || 'motor') === 'motor') && !app.video;
    const show = here && this.on;
    if (this.vis !== `${here}${show}${key}`) {
      this.vis = `${here}${show}${key}`;
      this.btn.style.display = here ? '' : 'none';
      this.btn.textContent = show ? 'Voltar ao 2D' : 'Ver em 3D';
      this.btn.classList.toggle('pri', !show);
      this.box.style.display = show ? 'block' : 'none';
      if (M) this.title.textContent = M.name;
      for (const k in this.made) this.made[k].stage.canvas.style.display = k === key ? '' : 'none';
      app.scene.set3d(show ? key : null);
    }
    this.cur = show ? this.made[key] : null;
    if (!this.cur) return;
    this.cur.stage.cssScale = app.k;
    this.cur.model.update(st, P, dt, app.scene.vib);
    this.cur.stage.render(dt);
  }
}
