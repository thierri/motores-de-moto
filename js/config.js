// Perfis dos motores (números próximos dos reais, ordem de grandeza certa).
// Unidades: mm para geometria, Nm, rpm, kW, m/s, kg. Ângulo do ciclo: 0° = PMS no início da admissão.
//   i4 – 4 cilindros em linha de superbike (inspirado na BMW S1000RR)
//   v2 – V-Twin 45° (inspirado no Harley-Davidson Milwaukee-Eight 114)

export const ENGINES = {
  i4: {
    key: 'i4',
    name: '4 em linha',
    title: 'Motor <em>4 em linha</em>',
    sub: 'superbike de 1.000 cc · 16 válvulas · inspirado na S1000RR',
    cyl: 4, valves: 16,
    bore: 80, stroke: 49.7, rod: 103, ch: 28,   // ch: altura do pino ao topo do pistão
    disp: 0.999, cr: 13.3,
    J: 0.030,                       // inércia girante kg·m²
    idle: 1250, limit: 14600, float: 15500, breakRpm: 16800,
    shiftCam: 9000,                 // troca do ressalto de admissão (ShiftCam)
    rpmMax: 16000,                  // escala dos instrumentos
    thr: 3.7,                       // capacidade relativa das borboletas (4 × 48 mm)
    fric: [4, 0.0011, 6e-8],        // atrito: a + b·rpm + c·rpm²
    starterT: 19, crankRpm: 380,
    adv: { a: 8, b: 30, rpm: 12000, max: 38 },
    lamRpm: 9000,
    curvePart: [
      [0, 38], [1000, 50], [2000, 61], [3000, 71], [4000, 79], [5000, 87], [6000, 93], [7000, 97.5],
      [8000, 100.5], [9000, 102], [10000, 98.5], [11000, 92.5], [12000, 85], [13000, 77], [14000, 69],
      [15000, 60], [16000, 50], [18000, 32],
    ],
    curveFull: [
      [0, 28], [1000, 38], [2000, 48], [3000, 58], [4000, 67], [5000, 75.5], [6000, 83.5], [7000, 90.5],
      [8000, 97], [9000, 103.5], [10000, 109], [11000, 113], [12000, 112.5], [13000, 110.5], [13750, 107.3],
      [14600, 100.5], [15500, 90], [16500, 75], [18000, 52],
    ],
    valve: {
      full: { ivo: -26, ivc: 226, lift: 11.2 },
      part: { ivo: -8, ivc: 204, lift: 9.3 },
      exh: { evo: 494, evc: 746, lift: 9.3 },
    },
    firing: { flat: [0, 180, 540, 360], cross: [0, 450, 270, 540] },
    order: { flat: '1-2-4-3', cross: '1-3-2-4' },
    cylNames: ['1', '2', '3', '4'],
    gearbox: {
      primary: 1.652, ratios: [0, 2.647, 2.091, 1.727, 1.5, 1.36, 1.261], final: 45 / 17,
      clutchMax: 300, slipper: 0.35, eff: 0.93,
    },
    bike: { m: 272, r: 0.32, CdA: 0.34, crr: 0.016, rho: 1.2 },
    egt: { idle: 330, load: 430, rpm: 150 },
    exhausts: { stock: 'Original', sport: 'Esportivo', open: 'Aberto' },
    heat: 0.3, hot: 112, tempName: 'água',
    // som: tubos do escape (m), forma do pulso (graus), silencioso por tipo [original, esportivo, aberto]
    snd: {
      prim: [0.62, 0.64, 0.61, 0.63], groups: [{ cyl: [0, 3], L: 0.38 }, { cyl: [1, 2], L: 0.39 }], coll: 0.55,
      tail: [0.42, 0.42, 0.30],
      pulse: { rise: 3, decay: 11, plat: 0.16, turb: 0.16, base: 0.26, baseLoad: 0.12, comb: 0.95, len: 260 },
      muf: [
        { f: 1100, flap: 1900, boom: 78, gain: 0.55, gainFlap: 0.25, sat: 0.6, g: -0.35 },
        { f: 3400, flap: 0, boom: 105, gain: 0.95, gainFlap: 0, sat: 1.0, g: -0.5 },
        { f: 6500, flap: 0, boom: 140, gain: 1.25, gainFlap: 0, sat: 1.5, g: -0.62 },
      ],
      airbox: 190, inRun: 0.13, block: [170, 380, 1150], ticks: [3900, 6100], tickAmp: [0.05, 0.25],
      whine: [23, 37], whineAmp: [0.012, 0.006], idleVarRpm: 6000, rpmRef: 14000, mech: 0.35, out: 1.5,
      flapRpm: 7500,
    },
  },

  v2: {
    key: 'v2',
    name: 'V-Twin',
    title: 'Motor <em>V-Twin 45°</em>',
    sub: '1.868 cc · 2 cilindros · varetas · inspirado no Harley-Davidson Milwaukee-Eight 114',
    cyl: 2, valves: 8,
    bore: 102, stroke: 114.3, rod: 190, ch: 36,
    disp: 1.868, cr: 10.5,
    J: 0.155,                       // volantes pesados: sobe e desce de giro devagar
    idle: 850, limit: 5800, float: 6300, breakRpm: 6900,
    shiftCam: null,
    rpmMax: 7000,
    thr: 2.2,                       // uma borboleta de 55 mm
    fric: [7, 0.0032, 3.4e-7],
    starterT: 46, crankRpm: 300,
    adv: { a: 10, b: 24, rpm: 5000, max: 36 },
    lamRpm: 3500,
    curveFull: [
      [0, 95], [700, 112], [1000, 120], [1500, 132], [2000, 142], [2500, 150], [3000, 154], [3250, 155],
      [3500, 154], [4000, 150], [4500, 143], [5000, 134], [5500, 120], [6000, 104], [6500, 86], [7500, 58],
    ],
    valve: {
      full: { ivo: -18, ivc: 222, lift: 12.6 },
      exh: { evo: 490, evc: 738, lift: 12.6 },
    },
    // V a 45° com um moente só: dianteiro explode, 315° depois o traseiro, 405° depois o dianteiro
    firing: { v45: [0, 405] },
    order: { v45: 'dianteiro → 315° → traseiro → 405°' },
    cylNames: ['dianteiro', 'traseiro'],
    gearbox: {
      primary: 1.45, ratios: [0, 3.34, 2.31, 1.72, 1.39, 1.18, 1.0], final: 2.2,
      clutchMax: 380, slipper: 0.4, eff: 0.92,
    },
    bike: { m: 460, r: 0.33, CdA: 0.62, crr: 0.018, rho: 1.2 },
    egt: { idle: 300, load: 420, rpm: 120 },
    exhausts: { stock: 'Original', sport: 'Esportivas', open: 'Abertas' },
    heat: 0.12, hot: 140, tempName: 'óleo',
    snd: {
      prim: [1.05, 0.82], groups: null, coll: 0.28,
      tail: [0.55, 0.45, 0.18],
      pulse: { rise: 7, decay: 50, plat: 0.45, turb: 0.2, base: 0.3, baseLoad: 0.15, comb: 1.2, len: 300 },
      boomQ: 2.4, boomMix: 1.5, radDiff: 0.8,
      muf: [
        { f: 650, flap: 0, boom: 52, gain: 0.75, gainFlap: 0, sat: 0.7, g: -0.4 },
        { f: 1500, flap: 0, boom: 66, gain: 1.0, gainFlap: 0, sat: 1.1, g: -0.55 },
        { f: 4200, flap: 0, boom: 85, gain: 1.35, gainFlap: 0, sat: 1.8, g: -0.66 },
      ],
      airbox: 115, inRun: 0.2, block: [105, 240, 640], ticks: [2300, 4200], tickAmp: [0.15, 0.35],
      whine: [26, 0], whineAmp: [0.006, 0], idleVarRpm: 2500, rpmRef: 5800, mech: 0.6, out: 1.1,
      flapRpm: 99999,
    },
  },
};

// Mapas do acelerador eletrônico: curva da manopla → borboleta, rapidez e limite
export const MODES = {
  rain: { name: 'Chuva', exp: 1.8, tau: 0.12, max: 0.62 },
  road: { name: 'Estrada', exp: 1.35, tau: 0.06, max: 1 },
  dynamic: { name: 'Dinâmico', exp: 1.1, tau: 0.035, max: 1 },
  race: { name: 'Corrida', exp: 1.0, tau: 0.018, max: 1 },
};

// atalhos de ponteira: quanto o silencioso abafa (1 = original fechado, 0 = nada)
export const EXH_PRESETS = { stock: 1, sport: 0.5, open: 0.12 };
// abertura do escapamento: 0 = original fechado, 1 = sem silencioso
export const exhaustOpen = (P) => (P.muffler === false ? 1 : 1 - (P.baffle ?? 1));

const COMMON = {
  exhaust: 'stock',     // atalho escolhido: 'stock' | 'sport' | 'open' | 'custom'
  muffler: true,        // com silencioso
  baffle: 1,            // abafamento do silencioso (0–1)
  pipeLen: 1,           // comprimento dos tubos (multiplicador)
  flap: 'auto',         // válvula do escape (4 em linha): 'auto' | 'open' | 'closed'
  mode: 'road',
  inertia: 1,           // multiplicador da inércia
  advance: 0,           // graus a mais (+) ou a menos (−) que o ideal
  fuel: 1,              // multiplicador da injeção (λ = alvo ÷ fuel)
  knockCtl: true,       // sensor de detonação
  dtc: true,            // controle de tração
  anim: 'slow',         // 'slow' | 'real'
  failSpark: 0,         // cilindro com vela falhando (0 = nenhum)
  failFilter: false,    // filtro de ar entupido
};

export const DEFAULTS_BY = {
  i4: { ...COMMON, engine: 'i4', crank: 'flat', limit: 14600, idle: 1250, cr: 13.3, shiftCam: 'auto', qs: true },
  v2: { ...COMMON, engine: 'v2', crank: 'v45', limit: 5800, idle: 850, cr: 10.5, shiftCam: 'full', qs: false },
};
export const DEFAULTS = DEFAULTS_BY.i4;

export const profile = (P) => ENGINES[(P && P.engine) || 'i4'];

export const SITE_LINK = 'thierri.github.io/motores-de-moto';
