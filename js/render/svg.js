export const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function txt(parent, x, y, s, attrs = {}) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = s;
  return t;
}

export function attr(e, o) { for (const k in o) e.setAttribute(k, o[k]); }

// Escala frio/baixo → quente/alto: azul → verde → amarelo → laranja → vermelho (u de 0 a 1)
const STOPS = [
  [0.0, [56, 120, 230]],
  [0.3, [40, 190, 170]],
  [0.5, [90, 205, 90]],
  [0.7, [240, 205, 60]],
  [0.85, [250, 140, 40]],
  [1.0, [240, 50, 50]],
];
export function pColor(u) {
  u = Math.max(0, Math.min(1, u));
  for (let i = 1; i < STOPS.length; i++) {
    if (u <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
      const k = (u - a) / (b - a);
      const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(240,50,50)';
}

// pressão do gás (bar) → cor, em escala logarítmica de 0,25 a 110 bar
const LP0 = Math.log(0.25), LP1 = Math.log(110);
export const pressU = (bar) => (Math.log(Math.max(0.25, bar)) - LP0) / (LP1 - LP0);
export const gasColor = (bar) => pColor(pressU(bar));
// temperatura (°C) → cor: 20 °C azul, 1000 °C vermelho
export const tempColor = (c, lo = 20, hi = 1000) => pColor((c - lo) / (hi - lo));

export const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
export const fmtInt = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
