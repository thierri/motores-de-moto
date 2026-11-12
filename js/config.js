// Perfis dos motores (números próximos dos reais, ordem de grandeza certa).
// Unidades: mm para geometria, Nm, rpm, kW, m/s, kg. Ângulo do ciclo: 0° = PMS no início da admissão.
//   i4 – 4 cilindros em linha de superbike (inspirado na BMW S1000RR)
//   v2 – V-Twin 45° (inspirado no Harley-Davidson Milwaukee-Eight 114)
//   cg – monocilíndrico de 125 cc com varetas e carburador (inspirado na Honda CG 125 clássica)
// Carros (car: true): arrefecimento a água com radiador e ventoinha, câmbio em H, pneus que patinam
//   t4 – 4 cilindros em linha 2.0 turbo (inspirado no Golf GTI)
//   b6 – 6 cilindros boxer 3.4 aspirado (inspirado no Porsche Boxster S)
//   rx – Wankel de 2 rotores, 1,3 L (inspirado no Mazda RX-8)

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
    cluster: 'tft', dyno: { cv: 240, nm: 140 }, needFires: 3, kick: false, carb: false,
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
    cluster: 'chrome', speedMax: 220, dyno: { cv: 120, nm: 180 }, needFires: 2, kick: false, carb: false,
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
  cg: {
    key: 'cg',
    name: 'CG 125',
    title: 'Motor <em>CG 125</em>',
    sub: '124 cc · 1 cilindro · varetas · carburador · inspirado na Honda CG 125 clássica',
    cyl: 1, valves: 2,
    bore: 56.5, stroke: 49.5, rod: 98, ch: 25,
    disp: 0.124, cr: 9.2,
    J: 0.0095,                      // volante do magneto
    idle: 1400, limit: 9500, float: 10000, breakRpm: 10800,
    shiftCam: null,
    rpmMax: 11000,
    thr: 0.2,                       // carburador de 22 mm
    fric: [0.7, 0.00012, 6e-9],
    starterT: 0, crankRpm: 0,
    adv: { a: 10, b: 22, rpm: 7000, max: 32 },
    lamRpm: 6000,
    curveFull: [
      [0, 5.5], [1000, 6.5], [2000, 7.4], [3000, 8.2], [4000, 8.8], [5000, 9.3], [6000, 9.7], [6500, 9.8],
      [7000, 9.75], [8000, 9.6], [8500, 9.5], [9000, 9.0], [9500, 8.2], [10500, 6.4], [12000, 4],
    ],
    valve: {
      full: { ivo: -5, ivc: 210, lift: 6.5 },
      exh: { evo: 500, evc: 725, lift: 6.5 },
    },
    firing: { single: [0] },
    order: { single: 'uma explosão a cada duas voltas' },
    cylNames: ['único'],
    gearbox: {
      primary: 3.722, ratios: [0, 2.769, 1.722, 1.272, 1.0, 0.84], final: 3.0,
      clutchMax: 40, slipper: 1, eff: 0.9,
    },
    bike: { m: 190, r: 0.3, CdA: 0.6, crr: 0.02, rho: 1.2 },
    egt: { idle: 320, load: 380, rpm: 120 },
    exhausts: { stock: 'Original', sport: 'Esportiva', open: 'Aberta' },
    heat: 0.12, hot: 140, tempName: 'óleo',
    cluster: 'classic', speedMax: 120, dyno: { cv: 16, nm: 12 }, needFires: 1, kick: true, carb: true,
    snd: {
      prim: [1.25], groups: null, coll: 0.2,
      tail: [0.45, 0.38, 0.2],
      pulse: { rise: 6, decay: 40, plat: 0.4, turb: 0.2, base: 0.3, baseLoad: 0.15, comb: 1.25, len: 300 },
      boomQ: 2.0, boomMix: 1.0, radDiff: 1.2,
      muf: [
        { f: 900, flap: 0, boom: 70, gain: 0.65, gainFlap: 0, sat: 0.8, g: -0.4 },
        { f: 1900, flap: 0, boom: 90, gain: 0.95, gainFlap: 0, sat: 1.2, g: -0.55 },
        { f: 4500, flap: 0, boom: 110, gain: 1.3, gainFlap: 0, sat: 1.7, g: -0.65 },
      ],
      airbox: 220, inRun: 0.18, block: [180, 420, 1100], ticks: [2800, 5200], tickAmp: [0.1, 0.3],
      whine: [17, 0], whineAmp: [0.004, 0], idleVarRpm: 3000, rpmRef: 9500, mech: 0.5, out: 1.2,
      flapRpm: 99999,
    },
  },
  // ------------------------------------------------------------------ carros
  t4: {
    key: 't4', car: true,
    name: '4 cilindros turbo',
    title: 'Motor <em>4 cilindros turbo</em>',
    sub: '2.0 turbo · 16 válvulas · injeção direta · inspirado no Golf GTI',
    cyl: 4, valves: 16,
    bore: 82.5, stroke: 92.8, rod: 144, ch: 30,
    disp: 1.984, cr: 9.6,
    J: 0.17,
    idle: 800, limit: 6800, float: 7300, breakRpm: 7900,
    shiftCam: null,
    rpmMax: 8000,
    thr: 2.8,
    fric: [9, 0.0022, 2.5e-7],
    starterT: 70, crankRpm: 260,
    adv: { a: 6, b: 26, rpm: 5500, max: 32 },
    lamRpm: 4500,
    // torque com o turbo na pressão nominal; fora dela a física corrige pela densidade do ar
    curveFull: [
      [0, 250], [1000, 300], [1500, 340], [2000, 350], [4600, 350], [5000, 330], [5500, 297], [6200, 262],
      [6800, 222], [7500, 170], [8500, 100],
    ],
    valve: {
      full: { ivo: -8, ivc: 214, lift: 10 },
      exh: { evo: 500, evc: 730, lift: 9.5 },
    },
    firing: { inline: [0, 540, 180, 360] },
    order: { inline: '1-3-4-2' },
    cylNames: ['1', '2', '3', '4'],
    gearbox: {
      primary: 1, ratios: [0, 3.77, 2.09, 1.47, 1.10, 0.87, 0.73], final: 3.24,
      clutchMax: 480, slipper: 1, eff: 0.92,
    },
    bike: { m: 1420, r: 0.316, CdA: 0.70, crr: 0.012, rho: 1.2, grip: 0.62 },   // tração dianteira
    egt: { idle: 380, load: 400, rpm: 120 },
    exhausts: { stock: 'Original', sport: 'Esportivo', open: 'Direto' },
    heat: 1.9, hot: 108, tempName: 'água',
    cluster: 'car', speedMax: 280, dyno: { cv: 320, nm: 480 }, needFires: 3, kick: false, carb: false,
    turbo: { boost: 1.2, spool: [800, 1700], lag: 0.55 },
    vib: 'i4car', exhNote: 'Turbina no caminho: som abafado', sparkNote: 'Um cilindro sem faísca: o motor perde um quarto da força e treme na lenta.',
    snd: {
      prim: [0.32, 0.30, 0.31, 0.33], groups: null, coll: 0.9,
      tail: [0.9, 0.7, 0.4],
      pulse: { rise: 5, decay: 20, plat: 0.3, turb: 0.12, base: 0.2, baseLoad: 0.1, comb: 0.9, len: 240 },
      boomQ: 1.8, boomMix: 1.0, radDiff: 1.2,
      muf: [
        { f: 420, flap: 0, boom: 62, gain: 0.5, gainFlap: 0, sat: 0.6, g: -0.3 },
        { f: 1300, flap: 0, boom: 78, gain: 0.85, gainFlap: 0, sat: 0.9, g: -0.45 },
        { f: 3200, flap: 0, boom: 95, gain: 1.15, gainFlap: 0, sat: 1.4, g: -0.58 },
      ],
      airbox: 130, inRun: 0.3, block: [140, 320, 900], ticks: [3200, 5200], tickAmp: [0.06, 0.12],
      whine: [18, 0], whineAmp: [0.004, 0], idleVarRpm: 2500, rpmRef: 6800, mech: 0.4, out: 1.2,
      flapRpm: 99999,
    },
  },

  b6: {
    key: 'b6', car: true,
    name: 'Boxer 6',
    title: 'Motor <em>boxer de 6 cilindros</em>',
    sub: '3.4 aspirado · cilindros deitados e opostos · inspirado no Porsche Boxster S',
    cyl: 6, valves: 24,
    bore: 97, stroke: 78, rod: 145, ch: 30,
    disp: 3.436, cr: 12.5,
    J: 0.14,
    idle: 750, limit: 7500, float: 7900, breakRpm: 8500,
    shiftCam: null,
    rpmMax: 9000,
    thr: 5.6,
    fric: [13, 0.003, 2.5e-7],
    starterT: 95, crankRpm: 260,
    adv: { a: 8, b: 26, rpm: 6500, max: 36 },
    lamRpm: 5000,
    curveFull: [
      [0, 200], [1000, 250], [2000, 300], [3000, 330], [4000, 352], [4750, 360], [5500, 358], [6000, 348],
      [6400, 340.5], [7000, 305], [7500, 272], [8500, 190], [9500, 110],
    ],
    valve: {
      full: { ivo: -14, ivc: 222, lift: 11 },
      exh: { evo: 494, evc: 738, lift: 10 },
    },
    // cilindros 1-2-3 de um lado e 4-5-6 do outro; os opostos (1-4, 2-5, 3-6) se movem juntos
    firing: { boxer: [0, 240, 480, 360, 600, 120] },
    order: { boxer: '1-6-2-4-3-5' },
    cylNames: ['1', '2', '3', '4', '5', '6'],
    gearbox: {
      primary: 1, ratios: [0, 3.31, 1.95, 1.41, 1.13, 0.97, 0.82], final: 3.89,
      clutchMax: 520, slipper: 1, eff: 0.92,
    },
    bike: { m: 1430, r: 0.33, CdA: 0.58, crr: 0.012, rho: 1.2, grip: 0.95 },   // motor central, tração traseira
    egt: { idle: 360, load: 500, rpm: 140 },
    exhausts: { stock: 'Original', sport: 'Esportivo', open: 'Direto' },
    heat: 1.9, hot: 108, tempName: 'água',
    cluster: 'car', speedMax: 300, dyno: { cv: 360, nm: 400 }, needFires: 3, kick: false, carb: false,
    vib: 'boxer', exhNote: 'Um coletor para cada bancada', sparkNote: 'Um cilindro sem faísca: o seis perde o ritmo liso e o som fica manco.',
    // som: cada bancada tem o próprio coletor, de comprimento e volume diferentes. As explosões de uma
    // bancada vêm a cada 240° (ordem 1,5 do giro): é essa meia-ordem que dá a aspereza do seis boxer.
    // Por cima, a admissão ressonante canta acima de ~4.500 rpm (o uivo).
    snd: {
      prim: [0.40, 0.46, 0.52, 0.44, 0.50, 0.56], groups: [{ cyl: [0, 1, 2], L: 0.42, g: 1 }, { cyl: [3, 4, 5], L: 0.56, g: 0.78 }], coll: 0.5,
      tail: [0.6, 0.5, 0.3], cylGain: [1, 0.9, 1.06, 0.94, 1.05, 0.9],
      pulse: { rise: 3, decay: 12, plat: 0.18, turb: 0.2, saw: 0.14, base: 0.24, baseLoad: 0.12, comb: 1.0, len: 250 },
      boomQ: 1.6, boomMix: 0.7, radDiff: 2.2,
      formants: [[430, 3, 0.8], [1150, 4.5, 1.2], [2500, 4, 0.9]], fmDry: 0.8,
      zing: [[1500, 0.004, 0.03]],
      howl: { f: 330, q: 5, gain: 2.4, rpm: [4200, 6200] }, inGain: 1.5,
      muf: [
        { f: 900, flap: 0, boom: 70, gain: 0.5, gainFlap: 0, sat: 0.6, g: -0.35 },
        { f: 2600, flap: 0, boom: 88, gain: 0.85, gainFlap: 0, sat: 1.0, g: -0.5 },
        { f: 5500, flap: 0, boom: 110, gain: 1.15, gainFlap: 0, sat: 1.5, g: -0.6 },
      ],
      airbox: 160, inRun: 0.25, block: [150, 340, 1000], ticks: [3500, 5600], tickAmp: [0.12, 0.2],
      whine: [21, 0], whineAmp: [0.006, 0], idleVarRpm: 3000, rpmRef: 7500, mech: 0.35, out: 0.8,
      flapRpm: 99999,
    },
  },

  rx: {
    key: 'rx', car: true,
    name: 'Wankel',
    title: 'Motor <em>Wankel</em> de 2 rotores',
    sub: '1,3 L · rotativo, sem pistões nem válvulas · inspirado no Mazda RX-8',
    cyl: 2, valves: 0,              // "cilindros" = rotores; cada rotor tem 3 câmaras
    rotary: { R: 105, e: 15 },      // raio do rotor e excentricidade (mm)
    firesPerRev: 2,                 // cada rotor explode uma vez por volta do eixo
    bore: 100, stroke: 83, rod: 150, ch: 30,   // só para a curva de pressão (pistão equivalente)
    disp: 1.308, cr: 10,
    J: 0.085,
    idle: 850, limit: 9000, float: 10200, breakRpm: 11000,
    shiftCam: null,
    rpmMax: 10000,
    thr: 2.5,
    fric: [8, 0.0015, 1e-7],
    starterT: 60, crankRpm: 300,
    adv: { a: 5, b: 22, rpm: 7500, max: 28 },
    lamRpm: 6000,
    curveFull: [
      [0, 110], [1000, 140], [2000, 165], [3000, 182], [4000, 196], [5500, 211], [6500, 208], [7500, 203],
      [8200, 198], [9000, 180], [10000, 140], [11500, 80],
    ],
    // janelas equivalentes (num ciclo de 720°), para a curva de pressão e para o som
    valve: {
      full: { ivo: -6, ivc: 228, lift: 10 },
      exh: { evo: 486, evc: 732, lift: 10 },
    },
    firing: { rotary: [0, 180] },
    order: { rotary: 'rotor 1 → 180° → rotor 2' },
    cylNames: ['rotor 1', 'rotor 2'],
    gearbox: {
      primary: 1, ratios: [0, 3.76, 2.27, 1.65, 1.19, 1.0, 0.84], final: 4.44,
      clutchMax: 330, slipper: 1, eff: 0.92,
    },
    bike: { m: 1350, r: 0.32, CdA: 0.62, crr: 0.012, rho: 1.2, grip: 0.85 },   // tração traseira
    egt: { idle: 480, load: 430, rpm: 150 },   // o escape do rotativo é bem mais quente
    exhausts: { stock: 'Original', sport: 'Esportivo', open: 'Direto' },
    heat: 1.9, hot: 108, tempName: 'água',
    cluster: 'car', speedMax: 280, dyno: { cv: 280, nm: 260 }, needFires: 3, kick: false, carb: false,
    vib: 'rotary', exhNote: 'Janelas no lugar de válvulas', sparkNote: 'Um rotor sem faísca: o motor perde metade da força.',
    // som: a janela de escape abre de uma vez, com o gás ainda em alta pressão, e fica aberta por muito
    // tempo: o pulso é um dente de serra seco, cheio de harmônicos (o zumbido de "abelha brava"), com um
    // anel metálico na aresta da janela. Sem válvulas, quase não há ruído mecânico. Os dois rotores têm
    // tubos de comprimento diferente, o que deixa passar um pouco do ritmo de cada rotor.
    snd: {
      n: 4, off: [0, 180, 360, 540], units: 2,   // 2 rotores × 1 explosão por volta = ritmo de um 4 cilindros
      prim: [0.36, 0.44, 0.36, 0.44], groups: [{ cyl: [0, 2], L: 0.26, g: 1 }, { cyl: [1, 3], L: 0.34, g: 0.86 }], coll: 0.45,
      tail: [0.5, 0.36, 0.2],
      pulse: { rise: 1.2, decay: 5, plat: 0.05, turb: 0.2, saw: 0.55, base: 0.34, baseLoad: 0.14, comb: 1.0, len: 250 },
      boomQ: 1.6, boomMix: 0.4, radDiff: 2.4,
      formants: [[700, 3, 0.9], [1700, 3.5, 1.4], [3400, 3, 0.8]], fmDry: 0.7,
      zing: [[2600, 0.0025, 0.03], [4100, 0.0015, 0.012]],
      muf: [
        { f: 1400, flap: 0, boom: 75, gain: 0.5, gainFlap: 0, sat: 0.6, g: -0.35 },
        { f: 4200, flap: 0, boom: 100, gain: 0.9, gainFlap: 0, sat: 1.0, g: -0.5 },
        { f: 8000, flap: 0, boom: 130, gain: 1.2, gainFlap: 0, sat: 1.5, g: -0.62 },
      ],
      airbox: 210, inRun: 0.2, block: [200, 460, 1300], ticks: [4000, 6500], tickAmp: [0, 0.02],
      whine: [9, 27], whineAmp: [0.012, 0.008], idleVarRpm: 3500, rpmRef: 9000, mech: 0.2, out: 0.9,
      flapRpm: 99999,
    },
  },
};

// Mapas do acelerador eletrônico: curva da manopla → borboleta, rapidez e limite
export const MODES = {
  rain: { name: 'Chuva', car: 'Eco', exp: 1.8, tau: 0.12, max: 0.62 },
  road: { name: 'Estrada', car: 'Normal', exp: 1.35, tau: 0.06, max: 1 },
  dynamic: { name: 'Dinâmico', car: 'Esporte', exp: 1.1, tau: 0.035, max: 1 },
  race: { name: 'Corrida', car: 'Pista', exp: 1.0, tau: 0.018, max: 1 },
};
export const modeName = (P) => { const m = MODES[P.mode] || MODES.road; return ENGINES[P.engine]?.car ? m.car : m.name; };

// atalhos de ponteira: quanto o silencioso abafa (1 = original fechado, 0 = nada)
export const EXH_PRESETS = { stock: 1, sport: 0.5, open: 0.12 };
// abertura do escapamento: 0 = original fechado, 1 = sem silencioso
export const exhaustOpen = (P) => (P.muffler === false ? 1 : 1 - (P.baffle ?? 1));

const COMMON = {
  exhaust: 'sport',     // atalho escolhido: 'stock' | 'sport' | 'open' | 'custom'
  muffler: true,        // com silencioso
  baffle: 0.5,          // abafamento do silencioso (0–1)
  pipeLen: 1,           // comprimento dos tubos (multiplicador)
  flap: 'auto',         // válvula do escape (4 em linha): 'auto' | 'open' | 'closed'
  mode: 'road',
  inertia: 1,           // multiplicador da inércia
  advance: 0,           // graus a mais (+) ou a menos (−) que o ideal
  fuel: 1,              // multiplicador da injeção (λ = alvo ÷ fuel)
  knockCtl: true,       // sensor de detonação
  dtc: true,            // controle de tração
  anim: 'real',         // 'slow' | 'real'
  shake: true,          // vibração do motor no desenho
  failSpark: 0,         // cilindro com vela falhando (0 = nenhum)
  failFilter: false,    // filtro de ar entupido
};

export const DEFAULTS_BY = {
  i4: { ...COMMON, engine: 'i4', crank: 'flat', limit: 14600, idle: 1250, cr: 13.3, shiftCam: 'auto', qs: true },
  v2: { ...COMMON, engine: 'v2', crank: 'v45', limit: 5800, idle: 850, cr: 10.5, shiftCam: 'full', qs: false },
  cg: { ...COMMON, engine: 'cg', crank: 'single', limit: 9500, idle: 1400, cr: 9.2, shiftCam: 'full', qs: false, dtc: false },
};
// carros: clima, arrefecimento e as falhas que fazem o motor ferver
const CAR = {
  ...COMMON, shiftCam: 'full', qs: false, dtc: true,
  amb: 25,              // temperatura do ar (°C)
  fan: 'auto',          // ventoinha: 'auto' | 'on' (ligada direto) | 'off' (queimada)
  thermo: 'ok',         // válvula termostática: 'ok' | 'closed' (travada fechada) | 'open' (travada aberta)
  revMatch: true,       // punta-tacco automático nas reduções
  failLeak: false,      // vazamento de água
  failRad: false,       // radiador obstruído
  failBatt: false,      // bateria fraca
};
DEFAULTS_BY.t4 = { ...CAR, engine: 't4', crank: 'inline', limit: 6800, idle: 800, cr: 9.6, boost: 1.2, bov: 'atm' };
DEFAULTS_BY.b6 = { ...CAR, engine: 'b6', crank: 'boxer', limit: 7500, idle: 750, cr: 12.5 };
DEFAULTS_BY.rx = { ...CAR, engine: 'rx', crank: 'rotary', limit: 9000, idle: 850, cr: 10, port: 'stock', failApex: false, beep: true };
export const DEFAULTS = DEFAULTS_BY.i4;
export const CAR_KEYS = ['t4', 'b6', 'rx'], MOTO_KEYS = ['cg', 'v2', 'i4'];

export const profile = (P) => ENGINES[(P && P.engine) || 'i4'];

export const SITE_LINK = 'thierri.github.io/motores-de-moto';
