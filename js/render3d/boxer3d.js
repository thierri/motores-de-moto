// O boxer de 6 cilindros em 3D. Mesma física e mesmo ângulo visual do desenho 2D (scene-b6.js): aqui só
// muda a forma de mostrar. Medidas em milímetros, tiradas do perfil (curso, biela, diâmetro).
// Z corre ao longo do virabrequim (−Z = frente, onde ficam a polia e o radiador; +Z = volante e escape);
// os cilindros 1-2-3 ficam do lado −X e os 4-5-6 do lado +X.
import { ENGINES } from '../config.js';
import { cylPressure, intakeLift, exhaustLift, localAngle } from '../sim/engine.js';
import { gasColor, tempColor } from '../render/svg.js';

const E = ENGINES.b6;
const D2R = Math.PI / 180;
const R = E.stroke / 2, L = E.rod, CH = E.ch, HB = E.bore / 2;
const DECK = R + L + CH + 2, ROOF = DECK + 12;
const HEADW = 74, COVERW = 134;            // cabeçote e tampa de válvulas, medidos a partir da face do bloco
const CAMX = DECK + 104;
const OFF = E.firing.boxer;
const wc = (t) => tempColor(t, 20, 125);
// cilindro k: lado, posição no eixo e ângulo do moente no virabrequim (os opostos ficam a 180°)
const CY = OFF.map((off, k) => {
  const sd = k < 3 ? -1 : 1;
  return { sd, j: k % 3, z: ((k % 3) - 1) * 118 + sd * 17, delta: (sd < 0 ? 180 : 0) - off };
});
// escape: os três tubos de cada bancada se juntam em (MX, MY, MZ)
const MXD = DECK - 4, MY = -208, MZ = 250, MUFZ = 540;
const BUNDLE = [[0, 18], [-16, -9], [16, -9]];
// arrefecimento
const RAD = { z: -480, y: 20, w: 520, h: 300 };

// Incandescência: o aço começa a brilhar vermelho-escuro perto de 550 °C, fica vermelho-vivo a ~700 °C,
// laranja a ~850 °C e amarelado acima de 950 °C. Devolve o quanto brilha (0–1) e escreve a cor em c.
function glow(c, tC) {
  const u = Math.max(0, Math.min(1, (tC - 540) / 460));
  c.setRGB(Math.min(1, u * 2.4), Math.max(0, u - 0.3) * 0.95, Math.max(0, u - 0.75) * 0.9);
  return u;
}

export class Boxer3D {
  constructor(stage) {
    this.s = stage;
    this.xray = true;
    this.shells = [];
    this.fanA = 0; this.flow = 0; this.plAcc = 0; this.stAcc = 0;
    const T = stage.T;
    this.eng = new T.Group();       // tudo o que treme com o motor
    this.fix = new T.Group();       // preso ao carro: radiador, ventoinha, silencioso
    stage.root.add(this.eng, this.fix);
    this.col = new T.Color();
    this.buildCrank();
    this.buildCylinders();
    this.buildCases();
    this.buildIntake();
    this.buildExhaust();
    this.buildCooling();
    this.setXray(true);
  }

  // carcaça: material translúcido no raio-X e quase sólido fora dele
  shell(mesh, xr, solid) {
    mesh.userData.op = [xr, solid];
    this.shells.push(mesh);
    return mesh;
  }

  // ---------------------------------------------------------------- virabrequim
  buildCrank() {
    const s = this.s, T = s.T, eng = this.eng;
    const steel = this.steel = s.metal(0x8d99a8, 0.38, 0.55), dark = this.dark = s.metal(0x3a4859, 0.6, 0.4);
    const alu = this.alu = s.metal(0xb9c2cc, 0.42, 0.5), black = this.black = s.metal(0x20262e, 0.7, 0.2);
    const yel = s.metal(0xf2b632, 0.5, 0.2);
    const crank = this.crank = new T.Group();
    eng.add(crank);
    for (const z of [-178, -59, 59, 178]) s.mesh(s.cyl('z', 27, 34), steel, crank, 0, 0, z);
    for (const c of CY) {
      const a = c.delta * D2R, px = R * Math.cos(a), py = R * Math.sin(a);
      s.mesh(s.cyl('z', 22, 24), alu, crank, px, py, c.z);
      // braços: discos deslocados para o lado do moente, com o contrapeso do lado oposto
      for (const dz of [-15.5, 15.5]) s.mesh(s.cyl('z', 58, 7, 40), steel, crank, px * 0.28, py * 0.28, c.z + dz);
    }
    s.mesh(s.cyl('z', 16, 470), steel, crank, 0, 0, 10);
    // volante com a cremalheira da partida (atrás) e polia da correia (na frente)
    const fly = s.mesh(s.cyl('z', 146, 22, 64), dark, crank, 0, 0, 238);
    s.mesh(s.cyl('z', 152, 9, 96), black, crank, 0, 0, 238);
    s.mesh(s.cyl('z', 96, 26, 48), steel, crank, 0, 0, 240);
    for (let k = 0; k < 6; k++) s.mesh(s.cyl('z', 7, 28, 10), black, fly, 58 * Math.cos(k * 60 * D2R), 58 * Math.sin(k * 60 * D2R), 0);
    s.mesh(new T.BoxGeometry(12, 26, 24), yel, fly, 0, 128, 0);
    s.mesh(s.cyl('z', 60, 22, 40), dark, crank, 0, 0, -246);
    s.mesh(s.cyl('z', 64, 3, 40), black, crank, 0, 0, -236);
    s.mesh(s.cyl('z', 64, 3, 40), black, crank, 0, 0, -256);
    s.mesh(new T.BoxGeometry(9, 18, 24), yel, crank, 0, 50, -246);
  }

  // ---------------------------------------------------------------- pistões, bielas, válvulas
  buildCylinders() {
    const s = this.s, T = s.T, eng = this.eng, { steel, dark, alu, black } = this;
    const brass = s.metal(0xc08a62, 0.45, 0.5), blue = s.metal(0x7f9cc6, 0.45, 0.4);
    this.waterMats = [];
    this.cyl = CY.map((c, k) => {
      const o = { c }, sd = c.sd;
      // pistão: o topo fica em x = 0 do grupo, apontando para fora; saia recortada dos lados do pino
      o.piston = new T.Group(); o.piston.position.z = c.z; eng.add(o.piston);
      s.mesh(s.cyl('x', HB - 0.6, 26, 40), alu, o.piston, -sd * 13);
      s.mesh(s.cyl('x', HB - 1.2, 30, 40, true), alu, o.piston, -sd * 41).material.side = T.DoubleSide;
      s.mesh(s.cyl('x', HB - 6, 4, 40), alu, o.piston, sd * 1);                    // cabeça levemente abaulada
      for (const d of [6, 11, 17]) s.mesh(s.cyl('x', HB - 0.2, 2.2, 40), black, o.piston, -sd * d);
      s.mesh(s.cyl('z', 11, 2 * HB - 16), steel, o.piston, -sd * CH);
      // biela: origem no moente, comprimento ao longo de +X; perfil em "I"
      o.rod = new T.Group(); o.rod.position.z = c.z; eng.add(o.rod);
      s.mesh(new T.BoxGeometry(L - 46, 9, 13), steel, o.rod, L / 2 + 4);
      for (const y of [-10, 10]) s.mesh(new T.BoxGeometry(L - 50, 4, 20), steel, o.rod, L / 2 + 4, y);
      s.mesh(s.cyl('z', 33, 21, 32), steel, o.rod, 0);
      for (const y of [-34, 34]) s.mesh(s.cyl('x', 5, 30, 10), black, o.rod, 0, y);   // parafusos da capa
      s.mesh(s.cyl('z', 18, 21, 24), steel, o.rod, L);
      // camisa (vidro), o gás lá dentro com a cor da pressão, e a camisa d'água em volta
      s.mesh(s.cyl('x', HB + 4, DECK - 96, 40, true), s.glass(0x9fb4c9, 0.16), eng, sd * (96 + DECK) / 2, 0, c.z);
      const wm = s.glass(0x3878e6, 0.3); this.waterMats.push(wm);
      s.mesh(s.cyl('x', HB + 13, DECK - 126, 40, true), wm, eng, sd * (122 + DECK) / 2, 0, c.z);
      o.gasMat = new T.MeshStandardMaterial({ color: 0x3878e6, roughness: 0.6, transparent: true, opacity: 0.78, emissive: 0xff8a2c, emissiveIntensity: 0 });
      o.gas = s.mesh(s.cyl('x', HB - 1.2, 1, 40), o.gasMat, eng, 0, 0, c.z);
      o.flame = s.puff(0xffc46a, eng, true);
      o.flame.position.set(sd * (ROOF - 14), 0, c.z);
      // válvulas com mola e copo: duas de admissão em cima, duas de escape embaixo
      const valve = (y, zz, mat) => {
        const g = new T.Group(); g.position.set(sd * ROOF, y, c.z + zz); eng.add(g);
        s.mesh(s.cone(17, 6, 7, 24).rotateY(sd * Math.PI / 2), mat, g, sd * 3.5);
        s.mesh(s.cyl('x', 3.4, 70, 12), mat, g, sd * 40);
        s.mesh(new T.TorusGeometry(8.5, 1.5, 6, 18).rotateY(Math.PI / 2), steel, g, sd * 56);
        s.mesh(new T.TorusGeometry(8.5, 1.5, 6, 18).rotateY(Math.PI / 2), steel, g, sd * 62);
        s.mesh(new T.TorusGeometry(8.5, 1.5, 6, 18).rotateY(Math.PI / 2), steel, g, sd * 68);
        s.mesh(s.cyl('x', 12, 12, 18), dark, g, sd * 78);
        return g;
      };
      o.vIn = [valve(24, -21, blue), valve(24, 21, blue)];
      o.vEx = [valve(-24, -21, brass), valve(-24, 21, brass)];
      // vela, bobina e faísca
      s.mesh(s.cyl('x', 5, COVERW - 10, 12), s.metal(0xcfd6de, 0.4, 0.3), eng, sd * (ROOF + (COVERW - 10) / 2), 0, c.z);
      s.mesh(s.cyl('x', 13, 30, 18), black, eng, sd * (DECK + COVERW + 12), 0, c.z);
      s.mesh(new T.BoxGeometry(14, 16, 26), black, eng, sd * (DECK + COVERW + 26), 0, c.z);
      o.sparkMat = new T.MeshBasicMaterial({ color: 0xfffbd0, transparent: true, opacity: 0 });
      o.spark = s.mesh(new T.SphereGeometry(7, 12, 10), o.sparkMat, eng, sd * (ROOF - 4), 0, c.z);
      o.tag = s.label(`${k + 1}`, 52);
      o.tag.position.set(sd * (DECK + COVERW + 70), 0, c.z);
      eng.add(o.tag);
      return o;
    });

    // comandos (dois por bancada), girando na metade da rotação, com as engrenagens da corrente na frente
    this.cams = [];
    const pkIn = (E.valve.full.ivo + E.valve.full.ivc) / 2, pkEx = (E.valve.exh.evo + E.valve.exh.evc) / 2;
    for (const sd of [-1, 1]) for (const [y, pk, mat] of [[24, pkIn, blue], [-24, pkEx, brass]]) {
      const g = new T.Group(); g.position.set(sd * CAMX, y, sd * 17); eng.add(g);
      s.mesh(s.cyl('z', 8, 392, 16), mat, g, 0, 0, -10);
      s.mesh(s.cyl('z', 21, 7, 20), this.dark, g, 0, 0, -200);
      CY.forEach((c, k) => {
        if (c.sd !== sd) return;
        // o ressalto aponta para a válvula quando o levante é máximo
        const ang = ((sd > 0 ? 180 : 0) - (pk + OFF[k]) / 2) * D2R;
        for (const zz of [-21, 21]) s.mesh(s.cyl('z', 11, 13, 20), mat, g, 6 * Math.cos(ang), 6 * Math.sin(ang), c.z - sd * 17 + zz);
      });
      this.cams.push(g);
    }
  }

  // ---------------------------------------------------------------- bloco, cabeçotes, cárter
  buildCases() {
    const s = this.s, T = s.T, eng = this.eng;
    // cárter: perfil arredondado, dividido ao meio na vertical (a linha de junção aparece como aresta)
    const caseG = s.extrude((p) => {
      p.moveTo(-98, -78); p.lineTo(-98, 78); p.quadraticCurveTo(-98, 112, -60, 116); p.lineTo(60, 116);
      p.quadraticCurveTo(98, 112, 98, 78); p.lineTo(98, -78); p.quadraticCurveTo(98, -112, 60, -116); p.lineTo(-60, -116); p.quadraticCurveTo(-98, -112, -98, -78);
    }, 452, 4);
    s.edges(this.shell(s.mesh(caseG, s.glass(0x5b7088, 0.13), eng), 0.13, 0.9));
    s.mesh(new T.BoxGeometry(2, 236, 456), s.glass(0x9fb4c9, 0.18), eng);
    // campana da embreagem em volta do volante
    this.shell(s.mesh(s.cone(120, 172, 70, 48, true), s.glass(0x5b7088, 0.12), eng, 0, 0, 228), 0.12, 0.85);
    // tampa da frente (corrente de comando)
    s.edges(this.shell(s.mesh(new T.BoxGeometry(2 * (DECK + 120), 150, 16), s.glass(0x5b7088, 0.1), eng, 0, 0, -226), 0.1, 0.85));
    for (const sd of [-1, 1]) {
      const zc = sd * 17;
      // bloco da bancada
      s.edges(this.shell(s.mesh(new T.BoxGeometry(DECK - 98, 156, 372), s.glass(0x5b7088, 0.08), eng, sd * (98 + DECK) / 2, 0, zc), 0.08, 0.88));
      // cabeçote: fundido, com as duas "corcovas" dos comandos; a tampa de válvulas é uma peça à parte
      const headG = s.extrude((p) => { p.moveTo(0, -90); p.lineTo(0, 90); p.lineTo(50, 90); p.lineTo(HEADW, 66); p.lineTo(HEADW, -66); p.lineTo(50, -90); p.lineTo(0, -90); }, 384, 3, sd < 0);
      const head = this.shell(s.mesh(headG, s.glass(0x7f93a8, 0.2), eng, sd * DECK, 0, zc), 0.2, 0.92);
      s.edges(head, 0x9db6d8);
      const coverG = s.extrude((p) => {
        p.moveTo(HEADW, -66); p.lineTo(HEADW, 66); p.lineTo(100, 60); p.quadraticCurveTo(COVERW, 58, COVERW, 26); p.quadraticCurveTo(COVERW, 6, 120, 0);
        p.quadraticCurveTo(COVERW, -6, COVERW, -26); p.quadraticCurveTo(COVERW, -58, 100, -60); p.lineTo(HEADW, -66);
      }, 378, 3, sd < 0);
      s.edges(this.shell(s.mesh(coverG, s.glass(0x3d4b5c, 0.22), eng, sd * DECK, 0, zc), 0.22, 0.95), 0x7e8ea0);
      // parafusos da tampa e nervuras
      for (let z = -170; z <= 170; z += 68) for (const y of [-62, 62]) s.mesh(s.cyl('x', 5, 8, 8), this.black, eng, sd * (DECK + HEADW + 14), y, zc + z);
      // flanges de admissão (em cima) e de escape (embaixo)
      for (const c of CY) if (c.sd === sd) {
        s.mesh(new T.BoxGeometry(50, 8, 58), this.alu, eng, sd * (DECK + 30), 94, c.z);
        s.mesh(new T.BoxGeometry(48, 8, 54), this.steel, eng, sd * (DECK + 28), -94, c.z);
      }
    }
    // cárter de óleo com aletas
    const sump = s.mesh(new T.BoxGeometry(170, 42, 400), s.glass(0xb5832a, 0.3), eng, 0, -138, 0);
    s.edges(sump, 0xb5832a);
    for (let z = -180; z <= 180; z += 30) s.mesh(new T.BoxGeometry(172, 6, 4), this.dark, eng, 0, -161, z);
  }

  // ---------------------------------------------------------------- admissão
  buildIntake() {
    const s = this.s, eng = this.eng;
    const inMat = s.glass(0x8fb0d8, 0.4);
    s.mesh(new s.T.CapsuleGeometry(46, 250, 8, 28).rotateX(Math.PI / 2), inMat, eng, 0, 208, 10);
    s.mesh(s.cyl('z', 38, 60, 28), s.metal(0x9aa7b6, 0.5, 0.4), eng, 0, 208, -190);
    this.fly = s.mesh(s.cyl('z', 35, 3, 28), s.metal(0xe6edf3, 0.4, 0.3), eng, 0, 208, -212);
    this.runners = CY.map((c) => {
      const cv = s.curve([[c.sd * 26, 208, c.z], [c.sd * 120, 214, c.z], [c.sd * (DECK - 10), 180, c.z], [c.sd * (DECK + 30), 130, c.z], [c.sd * (DECK + 30), 96, c.z]]);
      s.tubeOn(cv, 19, inMat, eng, 30, 16);
      return { cv, sp: [0, 1, 2].map(() => s.puff(0xbfe3ff, eng)) };
    });
  }

  // ---------------------------------------------------------------- escapamento
  buildExhaust() {
    const s = this.s, T = s.T, eng = this.eng, fix = this.fix;
    // três tons de metal: os tubos junto ao cabeçote ficam em brasa primeiro
    const mk = () => new T.MeshStandardMaterial({ color: 0x7c8089, roughness: 0.42, metalness: 0.7, emissive: 0x000000, emissiveIntensity: 1 });
    this.exHot = mk(); this.exMid = mk(); this.exCool = mk();
    this.exCool.color.set(0x9aa3ad);
    // temperatura do metal de cada trecho (atrasada em relação ao gás) e o halo de luz em volta do que está em brasa
    this.exT = [25, 25, 25];
    this.halo = [];
    const chrome = s.metal(0xdfe5ea, 0.18, 0.9);
    this.exPath = [];
    for (const sd of [-1, 1]) {
      const mx = sd * MXD;
      CY.forEach((c, k) => {
        if (c.sd !== sd) return;
        const [ox, oy] = BUNDLE[c.j], x0 = sd * (DECK + 28);
        // primário: sai do flange para baixo, vira para trás e chega paralelo aos outros dois
        const pts = [[x0, -98, c.z], [x0, -138, c.z + 4], [x0 - sd * 14, -182, c.z + 34], [mx + ox, MY + oy, c.z + (MZ - 34 - c.z) * 0.6], [mx + ox, MY + oy, MZ - 34], [mx + ox * 0.9, MY + oy * 0.9, MZ]];
        const pc = s.curve(pts);
        s.tubeOn(pc, 16, this.exHot, eng, 44, 16);
        for (const u of [0.12, 0.45, 0.8]) { const h = s.puff(0xff5a1f, eng, true, false); h.position.copy(pc.getPointAt(u)); this.halo.push({ h, z: 0, size: 120 }); }
        // caminho do gás: o primário e depois o coletor, o catalisador e a entrada do silencioso
        this.exPath[k] = s.curve([...pts, [mx, MY, MZ + 60], [mx, MY, MZ + 160], [sd * 180, MY + 6, MUFZ - 96], [sd * 150, MY + 8, MUFZ - 60]]);
      });
      // junção 3 em 1, catalisador e curva até o silencioso
      s.mesh(s.cone(37, 27, 62), this.exMid, eng, mx, MY, MZ + 27);
      s.mesh(new T.TorusGeometry(37, 3, 8, 28), this.exMid, eng, mx, MY, MZ - 3);
      s.mesh(s.cone(27, 45, 24), this.exMid, eng, mx, MY, MZ + 70);
      s.mesh(s.cyl('z', 45, 78, 32), this.exMid, eng, mx, MY, MZ + 121);
      s.mesh(s.cone(45, 27, 24), this.exMid, eng, mx, MY, MZ + 172);
      for (const z of [MZ + 84, MZ + 158]) s.mesh(new T.TorusGeometry(45.5, 1.6, 6, 32), this.dark, eng, mx, MY, z);
      for (const z of [MZ + 20, MZ + 120]) { const h = s.puff(0xff5a1f, eng, true, false); h.position.set(mx, MY, z); this.halo.push({ h, z: 1, size: 200 }); }
      s.tubeOn(s.curve([[mx, MY, MZ + 180], [mx, MY, MZ + 205], [sd * 185, MY + 5, MUFZ - 100], [sd * 152, MY + 8, MUFZ - 70], [sd * 150, MY + 8, MUFZ - 50]]), 27, this.exCool, fix, 30, 18);
      // ponteira cromada, com o fundo escuro
      s.mesh(s.cyl('z', 27, 60, 28), this.exCool, fix, sd * 150, MY + 8, MUFZ + 82);
      s.mesh(s.cyl('z', 32, 46, 32, true), chrome, fix, sd * 150, MY + 8, MUFZ + 116).material.side = T.DoubleSide;
      s.mesh(s.cyl('z', 31, 2, 28), this.black, fix, sd * 150, MY + 8, MUFZ + 96);
    }
    // silencioso atravessado, com as cintas
    const muf = s.mesh(new T.CapsuleGeometry(64, 330, 10, 32).rotateZ(Math.PI / 2), this.exCool, fix, 0, MY + 8, MUFZ);
    muf.scale.set(1, 0.86, 1);
    for (const x of [-120, 120]) s.mesh(new T.TorusGeometry(65.5, 2.5, 6, 36).rotateY(Math.PI / 2), this.dark, fix, x, MY + 8, MUFZ).scale.set(1, 0.86, 1);
    // gases: um rastro de manchas por cilindro correndo pelos tubos, e a fumaça nas duas ponteiras
    this.exPuffs = CY.map(() => [0, 1, 2, 3, 4, 5].map(() => s.puff(0xffb060, this.eng, true)));
    this.plume = Array.from({ length: 44 }, () => ({ sp: s.puff(0xc9d3dd, fix, false, false), age: 9, life: 1 }));
  }

  // ---------------------------------------------------------------- arrefecimento
  buildCooling() {
    const s = this.s, T = s.T, eng = this.eng, fix = this.fix;
    const c = this.cool = {};
    const water = () => new T.MeshStandardMaterial({ color: 0x3878e6, roughness: 0.6, metalness: 0.05 });
    const plastic = s.metal(0x171c22, 0.75, 0.1), clampM = s.metal(0xcfd6de, 0.3, 0.8);
    const XL = -(RAD.w / 2 + 19), XR = RAD.w / 2 + 19, ZB = RAD.z + 22;       // caixas laterais e a face de trás
    // bocal de mangueira ao longo de Z (com o ressalto na ponta) e a abraçadeira
    const neck = (x, y, z0, z1, parent, mat, r = 17) => {
      s.mesh(s.cyl('z', r, Math.abs(z1 - z0), 24), mat, parent, x, y, (z0 + z1) / 2);
      s.mesh(new T.TorusGeometry(r, 2.2, 8, 24), mat, parent, x, y, z1);
    };
    const clamp = (x, y, z, parent, r = 21.5) => {
      s.mesh(new T.TorusGeometry(r, 2.4, 6, 28), clampM, parent, x, y, z);
      s.mesh(new T.BoxGeometry(9, 7, 6), clampM, parent, x, y + r + 2, z);
    };

    // ---------- radiador: colmeia de aletas, caixas laterais arredondadas, travessas e bocais ----------
    c.core = new T.MeshStandardMaterial({ color: 0x3878e6, roughness: 0.65, metalness: 0.25, map: s.linesTex(110) });
    s.mesh(new T.BoxGeometry(RAD.w, RAD.h, 26), c.core, fix, 0, RAD.y, RAD.z);
    c.tIn = water(); c.tOut = water();
    for (const [x, m] of [[XL, c.tIn], [XR, c.tOut]]) {
      const t = s.mesh(new T.CapsuleGeometry(21, RAD.h - 30, 8, 20), m, fix, x, RAD.y, RAD.z);
      t.scale.set(0.9, 1, 1.15);
      for (const y of [-110, -55, 0, 55, 110]) s.mesh(new T.BoxGeometry(40, 4, 52), plastic, fix, x, RAD.y + y, RAD.z);   // nervuras da caixa
    }
    for (const y of [-1, 1]) {
      s.mesh(new T.BoxGeometry(RAD.w + 6, 7, 32), plastic, fix, 0, RAD.y + y * (RAD.h / 2 + 3.5), RAD.z);
      for (const x of [-170, 170]) s.mesh(s.cyl('y', 9, 22, 14), plastic, fix, x, RAD.y + y * (RAD.h / 2 + 16), RAD.z);        // pinos de fixação
    }
    neck(XL, 118, ZB - 6, ZB + 44, fix, c.tIn);      // entrada (água quente), em cima
    neck(XR, -98, ZB - 6, ZB + 44, fix, c.tOut);     // saída (água fria), embaixo
    neck(XR, 150, ZB - 6, ZB + 22, fix, c.tOut, 6);  // respiro para o reservatório

    // ---------- ventoinha elétrica: defletor com o furo redondo, suportes, motor e pás em curva ----------
    const fz = RAD.z + 34;
    const shroud = s.extrude((p) => {
      const w = RAD.w / 2 - 6, h = RAD.h / 2 - 6;
      p.moveTo(-w, -h); p.lineTo(w, -h); p.lineTo(w, h); p.lineTo(-w, h); p.lineTo(-w, -h);
      const hole = new T.Path(); hole.absarc(0, 0, 146, 0, Math.PI * 2, true); p.holes.push(hole);
    }, 10, 2);
    s.mesh(shroud, s.glass(0x171c22, 0.55), fix, 0, RAD.y, fz);
    s.mesh(s.cyl('z', 149, 34, 56, true), plastic, fix, 0, RAD.y, fz + 12).material.side = T.DoubleSide;
    for (const a of [30, 150, 270]) {
      const st = s.mesh(new T.BoxGeometry(124, 9, 6), plastic, fix, 88 * Math.cos(a * D2R), RAD.y + 88 * Math.sin(a * D2R), fz + 30);
      st.rotation.z = a * D2R;
    }
    s.mesh(s.cyl('z', 32, 36, 28), this.dark, fix, 0, RAD.y, fz + 22);
    s.mesh(s.cyl('z', 22, 10, 24), plastic, fix, 0, RAD.y, fz + 44);
    c.fan = new T.Group(); c.fan.position.set(0, RAD.y, fz + 2); fix.add(c.fan);
    c.fanMat = new T.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.45, metalness: 0.15, transparent: true, opacity: 1, side: T.DoubleSide });
    const blade = s.extrude((p) => {
      p.moveTo(-13, 30); p.quadraticCurveTo(-40, 86, -24, 136); p.quadraticCurveTo(8, 146, 36, 130); p.quadraticCurveTo(34, 82, 13, 30); p.lineTo(-13, 30);
    }, 3, 0);
    for (let k = 0; k < 7; k++) {
      const arm = new T.Group(); arm.rotation.z = k * 2 * Math.PI / 7; c.fan.add(arm);
      const b = s.mesh(blade, c.fanMat, arm);
      b.rotation.y = 0.45;                                                // passo da pá
    }
    s.mesh(s.cyl('z', 38, 20, 28), plastic, c.fan);
    s.mesh(new T.TorusGeometry(140, 2.5, 6, 56), c.fanMat, c.fan);         // anel que une as pontas das pás
    c.led = s.mesh(new T.SphereGeometry(7, 12, 10), new T.MeshBasicMaterial({ color: 0x26313d }), fix, 0, RAD.y, fz + 52);

    // ---------- no motor: termostática com bocal, bomba d'água com polia e os tubos que vêm dos cabeçotes ----------
    c.hot = water(); c.cold = water(); c.rail = water();
    s.mesh(s.cyl('z', 26, 26, 24), this.alu, eng, 0, 122, -246);
    s.mesh(new T.SphereGeometry(26, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), this.alu, eng, 0, 122, -259);
    for (const a of [40, 160, 280]) s.mesh(s.cyl('z', 4, 30, 8), this.black, eng, 30 * Math.cos(a * D2R), 122 + 30 * Math.sin(a * D2R), -244);
    neck(0, 122, -270, -312, eng, this.alu);
    c.gate = s.mesh(new T.BoxGeometry(34, 5, 5), s.metal(0xf2b632, 0.5, 0.2), eng, 0, 156, -252);
    const PX = 84, PY = 40;
    s.mesh(s.cyl('z', 44, 24, 36), this.alu, eng, PX, PY, -246);
    s.mesh(s.cone(44, 30, 14, 36), this.alu, eng, PX, PY, -265);
    s.mesh(new T.BoxGeometry(46, 40, 24), this.alu, eng, PX + 44, PY - 22, -246);         // voluta até o bocal de entrada
    neck(PX + 58, PY - 26, -252, -304, eng, this.alu);
    c.pump = new T.Group(); c.pump.position.set(PX, PY, -280); eng.add(c.pump);
    s.mesh(s.cyl('z', 36, 14, 32), this.dark, c.pump);
    s.mesh(s.cyl('z', 10, 22, 16), this.steel, c.pump);
    for (let k = 0; k < 5; k++) {
      const sp = s.mesh(new T.BoxGeometry(5, 20, 3), s.metal(0xf2b632, 0.5, 0.2), c.pump, 20 * Math.cos(k * 72 * D2R), 20 * Math.sin(k * 72 * D2R), -8);
      sp.rotation.z = k * 72 * D2R + Math.PI / 2;
    }
    for (const sd of [-1, 1]) {
      s.tubeOn(s.curve([[sd * (DECK + 34), 98, -196 + sd * 17], [sd * (DECK + 30), 122, -212], [sd * 130, 134, -236], [sd * 50, 126, -246], [sd * 22, 122, -246]]), 10, c.rail, eng, 28, 12);
      s.mesh(new T.TorusGeometry(10.5, 2, 6, 16).rotateY(Math.PI / 2), this.alu, eng, sd * 26, 122, -246);
    }

    // ---------- mangueiras: saem e chegam alinhadas com os bocais, presas por abraçadeiras ----------
    // a de cima leva a água quente da termostática para o radiador; a de baixo traz a água resfriada para a bomba
    c.up = s.curve([[0, 122, -292], [0, 122, -340], [-70, 150, -392], [-200, 150, -372], [XL, 118, ZB + 110], [XL, 118, ZB + 62], [XL, 118, ZB + 24]]);
    c.low = s.curve([[XR, -98, ZB + 24], [XR, -98, ZB + 70], [XR - 20, -90, ZB + 130], [PX + 100, -40, -340], [PX + 58, PY - 26, -330], [PX + 58, PY - 26, -286]]);
    s.tubeOn(c.up, 20.5, c.hot, fix, 64, 20);
    s.tubeOn(c.low, 20.5, c.cold, fix, 64, 20);
    clamp(0, 122, -300, fix); clamp(XL, 118, ZB + 34, fix); clamp(XR, -98, ZB + 34, fix); clamp(PX + 58, PY - 26, -294, fix);
    c.dots = [c.up, c.low].map((cv) => ({ cv, sp: [0, 1, 2, 3, 4, 5].map(() => s.puff(0xffffff, fix)) }));

    // ---------- reservatório de expansão: frasco arredondado, com o nível, a tampa e o vapor ----------
    const TX = 262, TY = 236, TZ = -360;
    const round = (w, h, r) => (p) => {
      p.moveTo(-w + r, -h); p.lineTo(w - r, -h); p.quadraticCurveTo(w, -h, w, -h + r); p.lineTo(w, h - r); p.quadraticCurveTo(w, h, w - r, h);
      p.lineTo(-w + r, h); p.quadraticCurveTo(-w, h, -w, h - r); p.lineTo(-w, -h + r); p.quadraticCurveTo(-w, -h, -w + r, -h);
    };
    s.edges(s.mesh(s.extrude(round(50, 42, 16), 76, 8), s.glass(0xe6edf3, 0.24), fix, TX, TY, TZ), 0xc3cad4, 40);
    c.lvlMat = new T.MeshStandardMaterial({ color: 0x3878e6, roughness: 0.4, transparent: true, opacity: 0.85 });
    c.lvl = s.mesh(s.extrude(round(46, 38, 13), 68, 6), c.lvlMat, fix, TX, TY, TZ);
    c.lvlY = TY;
    for (const y of [-12, 14]) s.mesh(new T.BoxGeometry(12, 2, 2), plastic, fix, TX + 50, TY + y, TZ + 20);    // marcas de mínimo e máximo
    s.mesh(s.cyl('y', 15, 10, 20), plastic, fix, TX - 14, TY + 46, TZ);
    s.mesh(s.cyl('y', 19, 12, 24), plastic, fix, TX - 14, TY + 55, TZ);
    c.capY = TY + 62; c.capX = TX - 14; c.capZ = TZ;
    s.mesh(s.cyl('y', 6, 14, 12), plastic, fix, TX + 20, TY - 48, TZ - 10);
    s.tubeOn(s.curve([[TX + 20, TY - 52, TZ - 10], [TX + 22, TY - 80, TZ - 30], [XR, 150, ZB + 60], [XR, 150, ZB + 16]]), 7.5, c.cold, fix, 24, 10);
    clamp(XR, 150, ZB + 24, fix, 8.5);
    c.steam = Array.from({ length: 24 }, () => ({ sp: s.puff(0xeef3f8, fix, false, false), age: 9, life: 1 }));
  }

  // carcaças: raio-X (dá para ver tudo) ou quase sólidas
  setXray(on) {
    this.xray = on;
    for (const m of this.shells) { m.material.opacity = m.userData.op[on ? 0 : 1]; m.material.depthWrite = !on; }
    // com as carcaças fechadas, a chama e o ar da admissão ficam escondidos lá dentro
    for (const o of this.cyl) o.flame.material.depthTest = !on;
    for (const r of this.runners) for (const sp of r.sp) sp.material.depthTest = !on;
  }

  // ======================================================================
  update(st, P, dt, vib) {
    const th0 = st.vis.theta;
    this.crank.rotation.z = th0 * D2R;
    const running = st.running && !st.broken;
    const combOn = running && st.comb > 0 && !st.cut.any;
    const pOpt = { pr: st.map, adv: st.adv, cr: P.cr, lambda: st.lambda, E };
    const egt = st.temp.egt, hotU = Math.max(0, Math.min(1, (egt - 300) / 500));
    this.cyl.forEach((o, k) => {
      const c = o.c, sd = c.sd;
      const th = localAngle(st, P, E, k), a = (th % 360) * D2R;
      const pinA = (th0 + c.delta) * D2R, px = R * Math.cos(pinA), py = R * Math.sin(pinA);
      const ppD = R * Math.cos(a) + Math.sqrt(L * L - (R * Math.sin(a)) ** 2);   // pino do pistão: distância do eixo
      const crown = ppD + CH;
      o.piston.position.x = sd * crown;
      o.rod.position.x = px; o.rod.position.y = py;
      o.rod.rotation.z = Math.atan2(-py, sd * ppD - px);
      const cmb = combOn && (k + 1) !== P.failSpark ? 1 : 0;
      const p = cylPressure(th, { ...pOpt, comb: cmb });
      const len = Math.max(1, ROOF - crown);
      o.gas.scale.x = len;
      o.gas.position.x = sd * (crown + len / 2);
      o.gasMat.color.setStyle(gasColor(p));
      const ds = th - (360 - st.adv);
      const xb = cmb && ds > 0 ? 1 - Math.exp(-5 * Math.pow(Math.min(1, ds / 55), 3)) : 0;
      const fa = cmb && ds > 0 && th < 520 ? Math.min(1, xb * 1.4) * (1 - Math.max(0, (th - 420) / 100)) : 0;
      o.gasMat.emissiveIntensity = 1.4 * fa;
      o.flame.material.opacity = 0.9 * fa;
      o.flame.scale.setScalar(40 + 150 * fa);
      o.flame.position.x = sd * (ROOF - 6 - len * 0.4);
      o.sparkMat.opacity = running && cmb && ds >= 0 && ds < 14 ? 1 : 0;
      const li = intakeLift(th, 1, E), le = exhaustLift(th, E);
      o.vIn.forEach((v) => (v.position.x = sd * (ROOF - li * E.valve.full.lift * 1.6)));
      o.vEx.forEach((v) => (v.position.x = sd * (ROOF - le * E.valve.exh.lift * 1.6)));

      // ar entrando pelo duto de admissão enquanto a válvula está aberta
      const rn = this.runners[k];
      rn.sp.forEach((sp, i) => {
        const u = (((th - E.valve.full.ivo) / 110 + i / 3) % 1 + 1) % 1;
        sp.position.copy(rn.cv.getPointAt(u));
        sp.material.opacity = st.rpm > 30 ? 0.55 * li * Math.sin(Math.PI * u) : 0;
        sp.scale.setScalar(34);
      });
      // gás de escape: sai em jato quando a válvula abre e corre pelo tubo, esfriando e espalhando
      const u0 = ((th - E.valve.exh.evo + 720) % 720) / 250, cv = this.exPath[k];
      this.exPuffs[k].forEach((sp, i) => {
        const u = u0 - i * 0.05;
        if (u < 0 || u > 1 || st.rpm < 30) { sp.material.opacity = 0; return; }
        sp.position.copy(cv.getPointAt(Math.pow(u, 0.8)));
        const tail = 1 - i / 6;
        sp.material.opacity = (cmb ? 0.85 : 0.22) * tail * (1 - 0.55 * u);
        sp.scale.setScalar((cmb ? 46 + 26 * Math.min(1.4, st.map) : 34) * (0.75 + 0.5 * u) * (0.6 + 0.4 * tail));
        // de amarelo-claro (quente, junto ao cabeçote) a laranja escuro (já longe)
        sp.material.color.setRGB(1, 0.86 - 0.45 * u - 0.1 * (1 - hotU), 0.55 - 0.45 * u);
      });
    });
    this.cams.forEach((g) => (g.rotation.z = th0 / 2 * D2R));
    this.fly.rotation.x = (8 + st.tps * 82) * D2R;
    // o metal demora a esquentar e mais ainda a esfriar; cada trecho fica mais frio que o anterior
    const tgt = st.rpm > 50 ? [egt * 0.97, egt * 0.86, egt * 0.5] : [st.temp.amb, st.temp.amb, st.temp.amb];
    const lit = [this.exHot, this.exMid, this.exCool].map((m, i) => {
      this.exT[i] += (tgt[i] - this.exT[i]) * (1 - Math.exp(-dt / (tgt[i] > this.exT[i] ? 2.2 + i : 7 + 3 * i)));
      const u = glow(m.emissive, this.exT[i]);
      m.emissiveIntensity = 0.55 + 0.85 * u;
      m.roughness = 0.42 + 0.3 * u;
      return u;
    });
    for (const q of this.halo) {
      const u = lit[q.z];
      q.h.material.opacity = 0.5 * u * u;
      q.h.material.color.copy((q.z ? this.exMid : this.exHot).emissive);
      q.h.scale.setScalar(q.size * (0.8 + 0.5 * u));
    }
    this.exGlow = lit[0];
    this.updatePlume(st, P, dt, running);
    this.updateCooling(st, P, dt, running);
    // vibração e torção nos coxins (o eixo do motor é o Z); o que é preso ao carro fica parado
    if (vib) {
      this.eng.position.set(vib.x * 1.6, vib.y * 1.6, 0);
      this.eng.rotation.z = (vib.r + vib.tilt) * D2R;
    }
  }

  // fumaça nas ponteiras: mais gás e mais longe com giro e carga; branca e densa com o motor frio
  updatePlume(st, P, dt, running) {
    const rel = Math.min(1.1, Math.max(0, st.rpm) / E.limit);
    const load = Math.max(0, Math.min(1, st.pr)) * (st.comb > 0 ? 1 : 0.35);
    const flow = running ? (0.15 + 0.85 * rel) * (0.35 + 0.65 * load) : st.starter ? 0.08 : 0;
    const cold = st.temp.coolant < 50;
    this.plAcc += (flow > 0 ? 10 + 70 * flow : 0) * dt;
    while (this.plAcc >= 1) {
      this.plAcc -= 1;
      const q = this.plume.find((x) => x.age >= x.life);
      if (!q) break;
      const sd = Math.random() < 0.5 ? -1 : 1;
      q.age = 0; q.life = 0.7 + 0.6 * Math.random();
      q.x = sd * 150 + (Math.random() - 0.5) * 16; q.y = MY + 8 + (Math.random() - 0.5) * 16; q.z = MUFZ + 138;
      q.vz = (260 + 1500 * flow) * (0.75 + 0.5 * Math.random()); q.vx = (Math.random() - 0.5) * 90; q.vy = 20 + 60 * Math.random();
      q.r0 = 46 + 40 * flow; q.gr = 150 + 300 * flow;
      q.sp.material.color.set(cold ? 0xf2f6fa : st.lambda < 0.84 ? 0x70767e : 0xc9d3dd);
      q.op = cold ? 0.42 : 0.24;
    }
    for (const q of this.plume) {
      if (q.age >= q.life) { q.sp.material.opacity = 0; continue; }
      q.age += dt;
      const k = Math.exp(-1.6 * dt);
      q.vz *= k; q.vx *= k; q.z += q.vz * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const u = Math.min(1, q.age / q.life);
      q.sp.position.set(q.x, q.y, q.z);
      q.sp.scale.setScalar(q.r0 + q.gr * u);
      q.sp.material.opacity = q.op * Math.pow(1 - u, 1.4);
    }
  }

  updateCooling(st, P, dt, running) {
    const c = this.cool, Tm = st.temp, th = st.thermo, lvl = Math.max(0, Math.min(1, st.coolLvl));
    const pump = running ? 0.3 + 0.7 * Math.min(1, st.rpm / (0.5 * E.limit)) : 0;
    const radIn = Tm.rad + (Tm.coolant - Tm.rad) * 0.55 * th, radOut = Tm.rad - (Tm.rad - Tm.amb) * 0.25;
    const hot = wc(Tm.coolant);
    this.waterMats.forEach((m) => m.color.setStyle(hot));
    c.rail.color.setStyle(hot);
    c.hot.color.setStyle(wc(th > 0.05 ? Tm.coolant : (Tm.coolant + Tm.rad) / 2));
    c.cold.color.setStyle(wc(radOut));
    c.tIn.color.setStyle(wc(radIn)); c.tOut.color.setStyle(wc(radOut));
    c.core.color.setStyle(P.failRad ? '#6b5a3c' : wc(Tm.rad));
    c.lvlMat.color.setStyle(wc(Tm.rad));
    c.lvl.scale.y = Math.max(0.02, lvl);
    c.lvl.position.y = c.lvlY - 38 * (1 - Math.max(0.02, lvl));
    // termostática: a lâmina amarela deita (fechada) ou fica em pé (aberta)
    c.gate.rotation.z = th * Math.PI / 2;
    c.pump.rotation.z -= Math.min(900, st.rpm * 0.35) * D2R * dt;
    // ventoinha: gira quando liga; as pás viram um borrão em alta
    const spd = st.fanSpd;
    this.fanA += (spd * 760 + (spd < 0.05 ? Math.min(120, st.v * 4) : 0)) * D2R * dt;
    c.fan.rotation.z = -this.fanA;
    c.fanMat.opacity = 1 - 0.4 * Math.min(1, spd);
    c.led.material.color.set(P.fan === 'off' ? 0xff4d4d : spd > 0.1 ? 0x3ecf72 : 0x26313d);
    // água correndo pelas mangueiras: só com a termostática aberta
    const fl = pump * th * (lvl < 0.3 ? 0.1 : 1);
    this.flow = (this.flow + fl * 0.55 * dt) % 1;
    for (const d of c.dots) d.sp.forEach((sp, i) => {
      const u = (this.flow + i / 6) % 1;
      sp.position.copy(d.cv.getPointAt(u));
      sp.material.opacity = fl > 0.03 ? 0.75 * Math.sin(Math.PI * u) : 0;
      sp.scale.setScalar(26);
    });
    // vapor saindo do reservatório quando a água ferve
    this.stAcc += st.steam * 30 * dt;
    while (this.stAcc >= 1) {
      this.stAcc -= 1;
      const q = c.steam.find((x) => x.age >= x.life);
      if (!q) break;
      q.age = 0; q.life = 0.9 + 0.8 * Math.random();
      q.x = c.capX + (Math.random() - 0.5) * 20; q.y = c.capY; q.z = c.capZ + (Math.random() - 0.5) * 20;
      q.vx = (Math.random() - 0.5) * 120; q.vy = 220 + 200 * Math.random();
    }
    for (const q of c.steam) {
      if (q.age >= q.life) { q.sp.material.opacity = 0; continue; }
      q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const u = Math.min(1, q.age / q.life);
      q.sp.position.set(q.x, q.y, q.z);
      q.sp.scale.setScalar(50 + 190 * u);
      q.sp.material.opacity = 0.55 * (1 - u);
    }
  }
}
