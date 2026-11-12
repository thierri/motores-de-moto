// Roteiro do vídeo (modo apresentação). Cada cena é só dados; ver presentation.js.
// Os tempos seguem a narração gravada (video/edicao.json): t = segundos desde o começo da cena no vídeo.
// Para listar as palavras de cada cena nesse tempo: python3 -I video/tools/build.py --palavras
import { EXH_PRESETS } from '../config.js';
import { shift, kick } from '../sim/engine.js';

// ---------- ações ----------
// chave: no vídeo a bomba de combustível escorva em 0,6 s (no simulador são 2 s)
const key = (on = true) => (st, P, a) => {
  a.setKey(on);
  if (on && !P.carb && P.engine !== 'cg') { st.wasKey = true; st.pumpT = 0.6; }
};
const choke = (on) => (st, P, a) => a.setChoke(on);
const kickIt = (st, P, a) => kick(st, P);
const gear = (dir) => (st, P) => shift(st, P, dir);
const force = (p) => (st) => { st.forceP = p; };
const engine = (k) => (st, P, a) => { a.setEngine(k); a.st.forceP = 0.8; };
const hot = (k, extra = {}) => (st, P, a) => { a.hot(k); Object.assign(a.P, extra); a.params.sync(); };
const param = (o) => (st, P, a) => { Object.assign(a.P, o); a.params.sync(); };
const exhaust = (k) => param({ exhaust: k, baffle: EXH_PRESETS[k], muffler: true });
const warm = (c = 82) => (st) => { st.temp.coolant = c; st.temp.oil = c - 2; };
// quatro tempos: põe o desenho no começo do tempo `n` (0 admissão … 3 escape) e anda 180° até `next` segundos
const stroke = (n, dur) => (st) => { st.vis.theta = n * 180; st.visRpm = 180 / 6 / dur; };
const grip = (t, dur, g, ramp = 0.15) => [t, dur, { grip: g, ramp }];
const clutch = (t, dur) => [t, dur, { clutch: 1, ramp: 0.05 }];
const btn = (sel, i = 0) => ({ sel, i });
const row = (id) => ({ row: id });

export const SCENES = [
  // ================= Parte 1 · Mostrando o simulador =================
  {
    title: 'A clássica CG 125',
    prep: { engine: 'cg', running: true },
    moves: [grip(14.2, 0.45, 0.35), grip(17.15, 0.22, 0.85, 0.05), grip(17.6, 0.22, 0.9, 0.05), grip(18.05, 0.35, 1, 0.05)],
    spots: [[10.1, btn('#btnStart')], [11.4, btn('#btnChoke')], [12.7, 'tft'], [14.0, 'grip'], [15.6, null], [19.8, 'engine'], [27.4, null]],
    notes: [[0.5, 'Um simulador de motores de moto, feito com inteligência artificial.'], [9.9, 'Partida no pedal, afogador, conta-giros e acelerador.'],
      [19.8, 'E mais dois motores: o V-Twin da Harley-Davidson e o 4 cilindros da BMW S1000.'], [27.8, 'Roda no navegador do computador ou do celular.']],
    link: [27.8, 37.5],
    duration: 37.5,
  },
  {
    title: 'Ligando a CG',
    prep: { engine: 'cg', key: false, forceP: 0 },
    events: [[2.6, key()], [9.2, kickIt], [9.7, kickIt], [10.25, kickIt], [16.0, choke(true)], [18.35, force(1)], [18.4, kickIt]],
    spots: [[2.0, btn('#btnKey')], [3.5, 'tft'], [5.4, btn('#btnStart')], [12.6, null], [15.3, btn('#btnChoke')], [17.6, null], [20.8, 'tft'], [24.3, null]],
    views: [[16.1, 'dentro'], [18.3, null], [24.4, 'escape']],
    focuses: [[16.1, ['choke', 'carb']], [18.3, null]],
    notes: [[2.0, 'Primeiro a chave: o painel acende.'], [5.4, 'A CG não tem motor de partida: é no pedal.'], [12.6, 'Motor frio: ela demora a pegar.'],
      [15.3, 'O afogador deixa a mistura mais rica.'], [20.8, 'Fria, ela fica com a lenta alta.'], [24.4, 'E sai a fumaça branca do escape frio.']],
    duration: 26.7,
  },
  {
    title: 'O carburador por dentro',
    prep: { engine: 'cg', running: true, choke: true, warm: false },
    events: [[0.2, warm(48)], [1.7, choke(false)], [1.75, warm(70)]],
    moves: [grip(5.1, 3.6, 0.22, 1.2), grip(9.0, 3.4, 0.3, 0.4), grip(13.0, 0.5, 0.45, 0.1), grip(13.75, 0.5, 0.55, 0.1), grip(14.6, 0.8, 0.65, 0.1)],
    spots: [[1.2, btn('#btnChoke')], [2.6, null]],
    views: [[3.0, 'dentro']],
    notes: [[0.4, 'Esquentou: tira o afogador.'], [5.0, 'O acelerador levanta a válvula e puxa a agulha.'], [8.6, 'Passa mais gasolina, que vira névoa no ar.']],
    duration: 16.3,
  },
  {
    title: 'Andando de moto',
    prep: { engine: 'cg', running: true },
    events: [[4.3, gear(-1)], [7.3, gear(1)], [7.9, gear(1)], [8.35, gear(1)]],
    moves: [clutch(3.1, 2.1), grip(4.6, 2.5, 0.75, 0.4), clutch(7.15, 0.3), clutch(7.75, 0.3), clutch(8.2, 0.3),
      grip(7.45, 0.35, 0.7), grip(8.05, 0.25, 0.8), grip(8.5, 3.0, 1, 0.2), grip(11.5, 7.6, 0.45, 0.5)],
    spots: [[3.0, btn('#btnClutch')], [4.2, 'gearbox'], [5.3, 'grip'], [7.1, 'gearbox'], [9.4, null], [11.3, 'tft'], [13.9, 'dyno']],
    spots916: [[3.0, btn('#btnClutch')], [4.2, 'gearbox'], [5.3, 'grip'], [7.1, 'gearbox'], [9.4, null], [11.3, 'tft'], [13.9, 'nums']],
    notes: [[3.0, 'Embreagem, primeira e acelera.'], [7.2, 'Segunda, terceira, quarta.'], [11.3, 'Velocímetro e conta-giros.'], [13.9, 'A curva de potência e torque, com a bolinha onde o motor está.']],
    duration: 19.0,
  },
  {
    title: 'A Harley-Davidson',
    prep: { engine: 'cg', running: true },
    events: [[1.4, engine('v2')], [5.0, warm()], [5.2, key()]],
    moves: [[6.0, 1.7, { start: true, ramp: 0.01 }], grip(18.9, 2.6, 0.3, 0.9)],
    spots: [[0.4, 'engine'], [2.5, null], [5.0, btn('#btnKey')], [5.8, btn('#btnStart')], [8.0, null], [21.2, 'tft'], [26.1, null]],
    notes: [[1.4, 'Ao trocar de motor, ele começa desligado.'], [5.0, 'Chave e partida elétrica.'], [9.6, 'A lenta clássica: o batata-batata.'],
      [13.2, 'O motor sacode na lenta e fica liso quando sobe de giro.'], [21.2, 'Painel analógico, cromado.']],
    duration: 26.1,
  },
  {
    title: 'A BMW S1000',
    prep: { engine: 'v2', running: true },
    events: [[1.5, engine('i4')], [1.55, warm()], [1.7, key()], [14.3, gear(-1)], [16.8, gear(1)], [17.5, gear(1)], [18.3, gear(1)]],
    moves: [[2.35, 1.4, { start: true, ramp: 0.01 }], grip(8.6, 1.4, 0.3, 0.3), grip(10.0, 3.3, 1, 0.3),
      clutch(13.8, 1.0), grip(14.6, 9.3, 0.75, 0.6)],
    spots: [[1.3, 'engine'], [2.3, null], [9.8, 'tft'], [13.6, 'gearbox'], [19.2, null]],
    views: [[19.4, 'escape']],
    notes: [[2.0, '4 cilindros, 1.000 cc, mais de 200 cv.'], [9.8, 'Passa de 14 mil rpm e bate no corte de giro.'], [14.1, 'Quickshifter: sobe marcha sem embreagem.'],
      [19.4, 'Quanto mais giro, mais gás sai do escapamento.']],
    duration: 23.9,
  },
  {
    title: 'Os parâmetros',
    prep: { engine: 'i4', running: true },
    events: [[3.8, exhaust('stock')], [5.0, exhaust('sport')], [5.65, exhaust('open')], [11.0, param({ muffler: false })], [14.0, exhaust('sport')]],
    moves: [grip(3.95, 0.5, 0.3), grip(5.1, 0.45, 0.3), grip(5.8, 0.5, 0.32), grip(6.7, 1.0, 0.36),
      grip(8.3, 0.75, 0.42, 0.1), grip(11.4, 0.7, 0.42, 0.1), grip(12.7, 0.7, 0.42, 0.1)],
    drawer: [[1.0, true]],
    spots: [[1.0, 'drawer'], [2.4, row('#pExh')], [8.3, null], [10.9, row('#pMuf')], [13.8, null], [16.7, row('#pLim')], [17.8, row('#pIdle')],
      [18.7, row('#pCr')], [19.6, row('#pAdv')], [21.4, row('#pDtc')], [23.9, row('#pAnim')], [26.0, row('#pSpark')]],
    notes: [[2.4, 'Escapamento: original, esportivo, aberto.'], [8.3, 'Pipocos ao soltar o acelerador.'], [11.0, 'E sem silencioso.'],
      [14.6, 'Corte de giro, lenta, compressão, ponto de ignição, controle de tração, animação e falhas.']],
    duration: 27.3,
  },
  // ================= Parte 2 · Por dentro do motor =================
  {
    title: 'Os quatro tempos',
    prep: { engine: 'cg', running: true },
    events: [[5.6, param({ anim: 'slow' })], [8.3, stroke(0, 4.3)], [12.6, stroke(1, 3.1)], [15.7, stroke(2, 3.4)], [19.1, stroke(3, 3.6)],
      [22.7, (st) => { st.visRpm = 22; }]],
    drawer: [[5.0, true], [7.2, false]],
    spots: [[5.0, row('#pAnim')], [7.2, null]],
    views: [[3.0, 'cyl']],
    focuses: [[8.3, ['intake', 'piston', 'chamber', 'carb']], [12.6, ['chamber', 'piston']], [15.7, ['spark', 'chamber', 'piston']],
      [19.1, ['header', 'chamber', 'piston']], [22.7, ['crank', 'rod', 'piston']], [25.2, null]],
    notes: [[5.0, 'Em câmera lenta.'], [8.3, '1 · Admissão: o pistão desce e puxa ar e gasolina.'], [12.6, '2 · Compressão: ele sobe e espreme a mistura.'],
      [15.7, '3 · Explosão: a vela solta a faísca e empurra o pistão.'], [19.1, '4 · Escape: ele sobe e empurra o gás queimado para fora.'],
      [22.7, 'Uma explosão a cada duas voltas do virabrequim.']],
    duration: 25.4,
  },
  {
    title: 'Um, dois ou quatro cilindros',
    prep: { engine: 'cg', running: true, P: { anim: 'slow' } },
    events: [[12.3, hot('v2', { anim: 'slow' })], [13.5, hot('i4', { anim: 'slow' })], [17.9, param({ anim: 'real' })]],
    moves: [grip(18.6, 3.2, 0.4, 0.6)],
    spots: [[0.4, 'engine'], [4.6, null], [12.3, 'engine'], [15.0, null]],
    notes: [[0.4, 'O som depende de quantos cilindros e de quando cada um explode.'], [7.0, 'CG: 1 cilindro, uma explosão a cada duas voltas.'],
      [12.3, 'Harley: 2 cilindros. BMW: 4, uma explosão a cada meia volta.'], [18.0, 'Por isso a BMW parece um grito contínuo.']],
    duration: 21.8,
  },
  {
    title: 'O ritmo da Harley',
    prep: { engine: 'v2', running: true, P: { anim: 'slow' } },
    views: [[0.0, null], [8.0, 'dentro']],
    focuses: [[1.3, ['cylinder', 'head']], [5.0, ['crank', 'rod']], [8.0, ['rhythm']], [17.4, null]],
    notes: [[0.3, 'Dois cilindros em V, a 45°, no mesmo moente do virabrequim.'], [8.0, 'As explosões não vêm igualmente espaçadas.'],
      [11.4, '315° e depois 405°.'], [17.4, 'Essa diferença é o batata-batata.']],
    duration: 21.2,
  },
  {
    title: 'A BMW por dentro',
    prep: { engine: 'i4', running: true, P: { anim: 'slow' } },
    events: [[10.8, param({ anim: 'real' })]],
    moves: [grip(12.2, 5.8, 1, 0.6)],
    views: [[0.0, 'dentro'], [10.8, null]],
    focuses: [[1.4, ['valveIn', 'valveEx']], [4.0, ['camIn', 'camEx']], [10.8, null]],
    spots: [[10.9, 'tft']],
    notes: [[0.3, '16 válvulas, 4 por cilindro.'], [4.0, 'O ShiftCam troca o perfil do comando: manso embaixo, bravo em cima.'], [10.9, 'O corte de giro protege o motor: passou de 14.600, a injeção corta.']],
    duration: 18.0,
  },
  {
    title: 'O comprimento dos tubos',
    prep: { engine: 'i4', running: true },
    events: [[3.7, param({ pipeLen: 1.5 })], [6.6, param({ pipeLen: 0.7 })], [9.6, param({ pipeLen: 1 })]],
    moves: [grip(4.3, 1.5, 0.36, 0.3), grip(7.1, 1.5, 0.36, 0.3), grip(9.8, 1.1, 0.33, 0.3)],
    views: [[0.0, 'escape'], [3.5, null]],
    focuses: [[0.3, ['header', 'exhaustSys']], [3.5, null]],
    spots: [[3.6, 'dyno']],
    spots916: [[3.6, row('#pLen')]],
    drawer916: [[3.4, true]],
    notes: [[0.3, 'O comprimento dos tubos muda o motor.'], [3.6, 'Tubo longo: mais força no meio do giro.'], [6.6, 'Tubo curto: mais força lá em cima.']],
    duration: 11.0,
  },
  {
    title: 'Uma vela falhando',
    prep: { engine: 'i4', running: true },
    events: [[0.9, param({ failSpark: 2 })], [8.0, param({ failSpark: 0 })]],
    moves: [grip(2.2, 5.6, 0.12, 0.6)],
    drawer: [[0.3, true], [2.0, false]],
    spots: [[0.3, row('#pSpark')], [2.0, null]],
    notes: [[0.3, 'Vela do cilindro 2 falhando.'], [2.2, 'O motor manca e treme muito mais.'], [7.7, 'Vela de volta: tudo normal.']],
    duration: 9.6,
  },
  {
    title: 'Agora é a sua vez',
    prep: { engine: 'cg', running: true },
    spots: [[7.2, btn('#engSel button', 0)], [9.7, btn('#engSel button', 2)], [10.4, btn('#engSel button', 1)], [11.6, null]],
    notes: [[0.4, 'Acesse, escolha a sua moto e brinque.']],
    link: [0.4, 14.9],
    duration: 14.9,
  },
];
