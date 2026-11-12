// Vibração do motor no desenho. Só a máquina treme: títulos, nomes e valores ficam parados.
// O modelo segue a física de cada motor:
//   4 em linha plano – vibração secundária (2× a rotação), vertical, cresce com o quadrado do giro
//   crossplane       – secundária quase anulada, sobra um leve balanço
//   V-Twin 45°       – desbalanceamento primário (1× a rotação) e explosões espaçadas: sacode forte na
//                      lenta e acalma acima de ~2.500 rpm (é o que as Harley fazem nos coxins)
// As fases avançam na frequência real; desenhadas a 60 quadros por segundo, viram um tremor irregular.
import { profile } from '../config.js';

const smooth = (x, a, b) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

// move para um subgrupo "tremível" tudo o que não é texto, nome, valor ou quadro fixo
export function wrapShake(g) {
  const sh = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const kids = [...g.childNodes];
  g.insertBefore(sh, g.firstChild);
  for (const k of kids) {
    if (k.nodeType !== 1) continue;
    if (k.tagName === 'text' || k.classList.contains('L-labels') || k.classList.contains('L-values') || k.classList.contains('noshake')) continue;
    sh.appendChild(k);
  }
  return sh;
}

export class Vibration {
  constructor() { this.reset(); }
  reset() { this.p1 = 0; this.p2 = 0; this.A = 0; this.x = 0; this.y = 0; this.r = 0; this.tilt = 0; this.tiltV = 0; }

  update(st, P, dt) {
    const E = profile(P);
    const rpm = Math.max(0, st.rpm);
    const run = st.running && !st.broken;
    const load = 0.6 + 0.4 * Math.max(0, Math.min(1, st.pr));
    let A = 0, rot = 0;
    // carros: o motor torce nos coxins quando o torque muda (mola amortecida: balança e assenta)
    const tgt = E.car && P.shake !== false && run ? 1.5 * Math.max(-0.25, Math.min(1.1, st.Tb / E.dyno.nm)) : 0;
    const h = Math.min(dt, 0.03);
    this.tiltV += (700 * (tgt - this.tilt) - 16 * this.tiltV) * h;
    this.tilt += this.tiltV * h;
    if (P.shake === false) A = 0;
    else if (run && E.car) {
      const rel = rpm / E.limit;
      if (E.vib === 'boxer') { A = (0.12 + 0.4 * rel * rel) * load; rot = 0.2 * A; }
      else if (E.vib === 'rotary') {
        A = 0.1 + 0.35 * rel * rel;
        if (P.port === 'bridge') A += 1.3 * (1 - smooth(rpm, 1200, 2600));     // lenta irregular da janela ampliada
        if (P.failApex) A += 0.7 * (1 - smooth(rpm, 1500, 4000));
        rot = 0.25 * A;
      } else { A = (0.45 * (1 - smooth(rpm, 850, 1700)) + 0.18 + 0.9 * rel * rel) * load; rot = 0.12 * A; }
      if (P.failSpark) A = A * 1.5 + 0.9 * (1 - smooth(rpm, 1500, 4500)) + 0.3;
      if (st.cut.lim) A *= 1.3;
      if (st.knock > 0.3) A += 0.4;
    } else if (run) {
      if (E.cyl === 1) {
        // monocilíndrico: desbalanceamento primário que cresce com o giro (o "formigamento" da CG)
        A = (0.9 + 1.7 * (rpm / E.limit) ** 1.5) * load;
        rot = 0.2 * A;
      } else if (E.cyl === 2) {
        A = (2.6 * (1 - smooth(rpm, 950, 2600)) + 0.5 + 0.9 * (rpm / E.limit) ** 2) * load;
        rot = 0.32 * A;
      } else {
        const k = P.crank === 'cross' ? 0.4 : 1;
        A = (0.25 + 2.3 * k * (rpm / E.limit) ** 2) * load;
        rot = 0.06 * A + (P.crank === 'cross' ? 0.35 * (rpm / E.limit) : 0);
      }
      if (P.failSpark) A *= 1.7;
      if (st.cut.lim) A *= 1.3;
    } else if ((st.starter || st.kickT > 0) && P.shake !== false) {
      A = E.car ? 0.7 : E.cyl === 2 ? 1.4 : E.cyl === 1 ? 1.1 : 0.6; rot = 0.3 * A;
    }
    this.A += (A - this.A) * (1 - Math.exp(-dt / 0.15));
    this.rot = rot;
    // fases: primária (1× rotação ou explosões) e secundária (2× rotação)
    const rev = rpm / 60;
    const f1 = E.car ? rev * (E.vib === 'boxer' ? 3 : E.vib === 'rotary' ? 1 : 2) * (P.failSpark ? 0.5 : 1) : E.cyl <= 2 ? rev : rev * 2;
    this.p1 = (this.p1 + 2 * Math.PI * f1 * dt) % (2 * Math.PI);
    this.p2 = (this.p2 + 2 * Math.PI * rev * 2 * dt + 0.37) % (2 * Math.PI);
    const a = this.A;
    if (E.cyl <= 2 && !E.car) {
      this.x = a * Math.sin(this.p1);
      this.y = 0.75 * a * Math.cos(this.p1) + 0.25 * a * Math.sin(this.p2);
      this.r = this.rot * Math.sin(this.p1 + 1.1);
    } else {
      this.x = 0.25 * a * Math.sin(this.p2 + 0.6);
      this.y = a * Math.sin(this.p2);
      this.r = this.rot * Math.sin(this.p1);
    }
    return this;
  }

  // transforma um grupo em volta de um ponto (cx, cy); k escala o movimento (vistas ampliadas tremem mais)
  // tiltK: quanto da torção nos coxins aparece nesta vista (1 = eixo do motor perpendicular à tela)
  apply(g, cx, cy, k = 1, tiltK = 0) {
    if (!g) return;
    const tilt = this.tilt * tiltK;
    if (this.A < 0.02 && Math.abs(tilt) < 0.01) { if (g._shk) { g.removeAttribute('transform'); g._shk = false; } return; }
    g._shk = true;
    g.setAttribute('transform', `translate(${(this.x * k).toFixed(2)} ${(this.y * k).toFixed(2)}) rotate(${(this.r * k + tilt).toFixed(3)} ${cx} ${cy})`);
  }
}
