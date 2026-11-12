// Gaveta de parâmetros e falhas.
import { fmt, fmtInt } from '../render/svg.js';
import { profile, EXH_PRESETS, MODES } from '../config.js';

const bar = (v) => `${fmt(v, 2)} bar`;

// faixas dos controles para cada motor
const RANGES = {
  i4: { limit: [10000, 17500, 100], idle: [900, 2500, 50], cr: [10, 15, 0.1] },
  v2: { limit: [4000, 7200, 50], idle: [600, 1400, 25], cr: [8.5, 12.5, 0.1] },
  cg: { limit: [7000, 11500, 50], idle: [900, 2200, 25], cr: [7.5, 11.5, 0.1] },
  t4: { limit: [5000, 7800, 50], idle: [600, 1400, 25], cr: [8, 12, 0.1] },
  b6: { limit: [5500, 8400, 50], idle: [600, 1400, 25], cr: [10, 14, 0.1] },
  rx: { limit: [6500, 10500, 50], idle: [600, 1800, 25], cr: [8.5, 11.5, 0.1] },
};

export class Params {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    root.innerHTML = `
      <h2>Parâmetros <button class="x" aria-label="Fechar">×</button></h2>
      <h4>Motor</h4>
      <div class="prow" id="rowCrank"><span>Virabrequim</span><div class="seg" id="pCrank"><button data-v="flat">Plano 180°</button><button data-v="cross">Crossplane 90°</button></div>
        <small>O plano explode a cada 180° (o "grito" de superbike). O crossplane explode em 270-180-90-180°: som irregular, grave, parecido com um V4.</small></div>

      <div class="prow"><span>Corte de giro</span><output id="pLimO"></output><input type="range" id="pLim" min="10000" max="17500" step="100">
        <small id="pLimS"></small></div>
      <div class="prow"><span>Marcha lenta</span><output id="pIdleO"></output><input type="range" id="pIdle" min="900" max="2500" step="50"></div>
      <div class="prow"><span>Inércia do volante</span><output id="pInO"></output><input type="range" id="pIn" min="0.5" max="3" step="0.05">
        <small>Mais inércia: o motor sobe e desce de giro mais devagar, e a lenta fica mais suave.</small></div>
      <div class="prow"><span>Taxa de compressão</span><output id="pCrO"></output><input type="range" id="pCr" min="10" max="15" step="0.1">
        <small>Mais compressão rende mais, mas aumenta a chance de detonação.</small></div>
      <div class="prow"><span>Avanço de ignição</span><output id="pAdvO"></output><input type="range" id="pAdv" min="-12" max="10" step="0.5">
        <small>Diferença em relação ao ponto ideal. Atrasar perde força e esquenta o escape; adiantar demais detona.</small></div>
      <div class="prow"><span>Combustível injetado</span><output id="pFuelO"></output><input type="range" id="pFuel" min="0.75" max="1.25" step="0.01">
        <small>Mais combustível = mistura rica (λ menor), mais pipocos no escape. Menos = pobre, mais quente e com risco de detonar.</small></div>
      <div class="prow" id="rowBoost"><span>Pressão do turbo</span><output id="pBoostO"></output><input type="range" id="pBoost" min="0.3" max="1.9" step="0.05">
        <small>É a wastegate que limita a pressão. Mais pressão = mais ar = mais força, até a mistura começar a detonar. Original: 1,20 bar.</small></div>
      <div class="prow" id="rowBov"><span>Válvula de alívio</span><div class="seg" id="pBov"><button data-v="atm">Para o ar (pshhh)</button><button data-v="recirc">Recirculada</button></div>
        <small>Quando você tira o pé, o ar comprimido precisa sair. Solta no ar faz o "pshhh"; a original devolve para a admissão, em silêncio.</small></div>
      <div class="prow" id="rowPort"><span>Janela de admissão</span><div class="seg" id="pPort"><button data-v="stock">Original</button><button data-v="bridge">Ampliada (bridgeport)</button></div>
        <small>A janela ampliada enche melhor em giro alto, mas admissão e escape se misturam na lenta: é o "brap-brap" dos rotativos preparados.</small></div>
      <div class="prow" id="rowBeep"><span>Apito do corte de giro</span><button class="sw b" id="pBeep"></button>
        <small>O rotativo sobe tão liso que o painel apita perto do corte para avisar a hora de trocar a marcha.</small></div>
      <div class="prow" id="rowCam"><span>ShiftCam</span><div class="seg" id="pCam"><button data-v="auto">Automático</button><button data-v="part">Só parcial</button><button data-v="full">Só pleno</button></div></div>
      <h4>Escapamento</h4>
      <div class="prow"><span>Ponteira</span><div class="seg" id="pExh"><button data-v="stock">Original</button><button data-v="sport">Esportivo</button><button data-v="open">Aberto</button></div>
        <small id="pExhS">Atalhos para o abafamento. Ajuste fino logo abaixo.</small></div>
      <div class="prow"><span>Com silencioso</span><button class="sw b" id="pMuf"></button>
        <small id="pMufS"></small></div>
      <div class="prow" id="rowBaffle"><span>Abafamento (miolo)</span><output id="pBafO"></output><input type="range" id="pBaf" min="0" max="1" step="0.01">
        <small>Mais miolo: mais silencioso e grave, perde um pouco em cima. Menos: mais alto, mais estalos.</small></div>
      <div class="prow"><span>Comprimento dos tubos</span><output id="pLenO"></output><input type="range" id="pLen" min="0.6" max="1.6" step="0.02">
        <small>Muda o tom e onde o motor tem mais força: tubo longo ajuda no meio, tubo curto em cima.</small></div>
      <div class="prow" id="rowFlap"><span>Válvula do escape</span><div class="seg" id="pFlap"><button data-v="auto">Automática</button><button data-v="open">Aberta</button><button data-v="closed">Fechada</button></div>
        <small>A original abre acima de 7.500 rpm com o acelerador aberto.</small></div>
      <div id="secCool">
      <h4>Arrefecimento e clima</h4>
      <div class="prow"><span>Temperatura do ar</span><output id="pAmbO"></output><input type="range" id="pAmb" min="0" max="45" step="1">
        <small>Num dia quente o radiador tem menos folga: a ventoinha liga mais e o motor ferve mais fácil.</small></div>
      <div class="prow"><span>Ventoinha</span><div class="seg" id="pFan"><button data-v="auto">Automática</button><button data-v="on">Ligada direto</button><button data-v="off">Queimada</button></div>
        <small>Automática: liga a 98 °C e desliga a 91 °C. Com o ar-condicionado ligado ela fica ligada.</small></div>
      <div class="prow"><span>Válvula termostática</span><div class="seg" id="pThermo"><button data-v="ok">Normal</button><button data-v="closed">Travada fechada</button><button data-v="open">Travada aberta</button></div>
        <small>Fechada, a água não chega ao radiador e o motor ferve em minutos. Aberta, o motor demora para esquentar.</small></div>
      </div>
      <h4 id="hDrive">Pilotagem e som</h4>
      <div class="prow"><span>Modo</span><div class="seg" id="pMode">${Object.entries(MODES).map(([k, m]) => `<button data-v="${k}">${m.name}</button>`).join('')}</div></div>
      <div class="prow"><span>Ouvir de</span><div class="seg" id="pListen"><button data-v="rear">Atrás da moto</button><button data-v="rider">Piloto</button></div></div>
      <h4>Eletrônica</h4>
      <div class="prow"><span>Sensor de detonação</span><button class="sw b" id="pKnock"></button></div>
      <div class="prow"><span>Controle de tração</span><button class="sw b" id="pDtc"></button></div>
      <div class="prow" id="rowQs"><span>Quickshifter</span><button class="sw b" id="pQs"></button>
        <small>Corta a ignição por ~55 ms para subir marcha sem embreagem e dá um "blip" no acelerador para reduzir.</small></div>
      <div class="prow" id="rowRev"><span>Punta-tacco automático</span><button class="sw b" id="pRev"></button>
        <small>Na redução, dá uma acelerada sozinho para igualar o giro do motor ao da marcha de baixo.</small></div>
      <h4>Camadas do desenho</h4>
      <div class="prow"><span>Cores (pressão e temperatura)</span><button class="sw b" id="lyGas"></button></div>
      <div class="prow"><span>Fluxo (tracinhos andando)</span><button class="sw b" id="lyFlow"></button></div>
      <div class="prow"><span>Nomes das peças</span><button class="sw b" id="lyLabels"></button></div>
      <div class="prow"><span>Valores</span><button class="sw b" id="lyValues"></button></div>
      <h4>Animação</h4>
      <div class="prow"><span>Velocidade do desenho</span><div class="seg" id="pAnim"><button data-v="slow">Câmera lenta</button><button data-v="real">Tempo real</button></div>
        <small>O som é sempre em tempo real. Em tempo real o desenho vira um efeito estroboscópico.</small></div>
      <div class="prow"><span>Vibração do motor</span><button class="sw b" id="pShake"></button>
        <small>O desenho treme como o motor de verdade: o V-Twin sacode na lenta, o 4 em linha zune em giro alto.</small></div>
      <h4>Falhas</h4>
      <div class="prow"><span>Vela falhando</span><div class="seg" id="pSpark"></div>
        <small id="pSparkS"></small></div>
      <div class="prow"><span>Filtro de ar entupido</span><button class="sw" id="pFilter"></button></div>
      <div id="secFailCar">
      <div class="prow"><span>Vazamento de água</span><button class="sw" id="pLeak"></button>
        <small>O nível do reservatório cai aos poucos. Sem água circulando, o motor ferve. "Recomeçar" completa a água.</small></div>
      <div class="prow"><span>Radiador obstruído</span><button class="sw" id="pRad"></button>
        <small>Colmeia suja de barro e insetos: passa pouco ar, e o radiador perde quase toda a capacidade.</small></div>
      <div class="prow"><span>Bateria fraca</span><button class="sw" id="pBatt"></button>
        <small>O motor de partida gira devagar e o motor custa a pegar, ainda mais frio.</small></div>
      <div class="prow" id="rowApex"><span>Vedações de ápice gastas</span><button class="sw" id="pApex"></button>
        <small>O ponto fraco do Wankel: as lâminas nas pontas do rotor. Gastas, a compressão vaza: custa a pegar, falha na lenta e perde força.</small></div>
      </div>
      <div class="pbtns"><button class="btn" id="pReset">Recomeçar</button><button class="btn" id="pDefaults">Valores padrão</button></div>`;
    const $ = (s) => root.querySelector(s);
    this.$ = $;
    $('.x').addEventListener('click', () => app.showDrawer(false));
    const seg = (id, key, num = false) => $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { app.P[key] = num ? +b.dataset.v : b.dataset.v; this.sync(); }
    });
    seg('#pCrank', 'crank'); seg('#pFlap', 'flap'); seg('#pMode', 'mode');
    seg('#pBov', 'bov'); seg('#pPort', 'port'); seg('#pFan', 'fan'); seg('#pThermo', 'thermo');
    $('#pExh').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) { app.P.exhaust = b.dataset.v; app.P.baffle = EXH_PRESETS[b.dataset.v]; app.P.muffler = true; this.sync(); }
    });
    $('#pListen').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { app.setListen(b.dataset.v); this.sync(); } });
    $('#pMuf').addEventListener('click', () => { app.P.muffler = !app.P.muffler; this.sync(); });
    $('#pBaf').addEventListener('input', (e) => { app.P.baffle = +e.target.value; app.P.exhaust = 'custom'; this.sync(); });
    $('#pLen').addEventListener('input', (e) => { app.P.pipeLen = +e.target.value; this.sync(); }); seg('#pCam', 'shiftCam'); seg('#pAnim', 'anim'); seg('#pSpark', 'failSpark', true);
    const rng = (id, key) => $(id).addEventListener('input', (e) => { app.P[key] = +e.target.value; this.sync(); });
    rng('#pBoost', 'boost'); rng('#pAmb', 'amb');
    rng('#pLim', 'limit'); rng('#pIdle', 'idle'); rng('#pIn', 'inertia'); rng('#pCr', 'cr'); rng('#pAdv', 'advance'); rng('#pFuel', 'fuel');
    const sw = (id, key) => $(id).addEventListener('click', () => { app.P[key] = !app.P[key]; this.sync(); });
    sw('#pBeep', 'beep'); sw('#pRev', 'revMatch'); sw('#pLeak', 'failLeak'); sw('#pRad', 'failRad'); sw('#pBatt', 'failBatt'); sw('#pApex', 'failApex');
    sw('#pKnock', 'knockCtl'); sw('#pShake', 'shake'); sw('#pDtc', 'dtc'); sw('#pQs', 'qs'); sw('#pFilter', 'failFilter');
    for (const [id, k] of [['#lyGas', 'gas'], ['#lyFlow', 'flow'], ['#lyLabels', 'labels'], ['#lyValues', 'values']]) {
      $(id).addEventListener('click', () => app.setLayers({ [k]: !app.scene.layers[k] }));
    }
    $('#pReset').addEventListener('click', () => app.reset());
    $('#pDefaults').addEventListener('click', () => app.defaults());
  }

  sync() {
    const P = this.app.P, $ = this.$, E = profile(P), R = RANGES[P.engine];
    if (this.engine !== P.engine) {
      this.engine = P.engine;
      $('#rowCrank').style.display = P.engine === 'i4' ? '' : 'none';
      $('#rowCam').style.display = E.shiftCam ? '' : 'none';
      for (const [id, k] of [['#pLim', 'limit'], ['#pIdle', 'idle'], ['#pCr', 'cr']]) { const el = $(id); el.min = R[k][0]; el.max = R[k][1]; el.step = R[k][2]; }
      const car = !!E.car;
      $('#pSpark').innerHTML = `<button data-v="0">Nenhuma</button>` + E.cylNames.map((n, i) => `<button data-v="${i + 1}">${E.rotary ? `Rotor ${i + 1}` : E.cyl === 2 ? (i ? 'Traseiro' : 'Dianteiro') : E.cyl === 1 ? 'Falhando' : n}</button>`).join('');
      for (const id of ['#secCool', '#secFailCar', '#rowRev']) $(id).style.display = car ? '' : 'none';
      $('#rowQs').style.display = car ? 'none' : '';
      $('#rowBoost').style.display = $('#rowBov').style.display = E.turbo ? '' : 'none';
      $('#rowPort').style.display = $('#rowApex').style.display = $('#rowBeep').style.display = E.rotary ? '' : 'none';
      $('#hDrive').textContent = car ? 'Direção e som' : 'Pilotagem e som';
      $('#pMode').querySelectorAll('button').forEach((b) => (b.textContent = car ? MODES[b.dataset.v].car : MODES[b.dataset.v].name));
      const lb = $('#pListen').querySelectorAll('button'); lb[0].textContent = car ? 'Atrás do carro' : 'Atrás da moto'; lb[1].textContent = car ? 'Motorista' : 'Piloto';
      $('#pExh').querySelectorAll('button').forEach((b) => (b.textContent = E.exhausts[b.dataset.v]));
      $('#pLimS').textContent = E.rotary ? `O Wankel não tem válvulas para flutuar: gira alto sem medo. Mas acima de ${fmtInt(E.breakRpm)} rpm as vedações de ápice saltam e riscam a carcaça.`
        : `Acima de ${fmtInt(E.float)} rpm as molas não seguram as válvulas (flutuação). Acima de ${fmtInt(E.breakRpm)} a válvula bate no pistão.`;
      $('#pSparkS').textContent = E.sparkNote ? E.sparkNote : E.cyl === 1 ? 'Sem faísca no único cilindro, o motor simplesmente não pega.' : E.cyl === 2 ? 'Um cilindro sem faísca: o V-Twin perde metade da força e vira um monocilíndrico manco.' : 'Um cilindro sem faísca: o motor perde um quarto da força e o som fica manco.';
      $('#pMufS').textContent = car ? 'Desligado: tubo direto, sem silencioso. Muito alto, e proibido na rua.' : E.cyl === 2 ? 'Desligado: drag pipes, tubos retos sem silencioso. O ronco mais alto e os pipocos mais fortes.' : 'Desligado: tubo direto, sem silencioso. Muito alto e cheio de estalos.';
      $('#rowFlap').style.display = E.key === 'i4' ? '' : 'none';
    }
    const segOn = (id, v) => $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
    segOn('#pCrank', P.crank); segOn('#pExh', P.muffler === false ? '' : P.exhaust); segOn('#pFlap', P.flap); segOn('#pMode', P.mode); segOn('#pListen', this.app.sound.listen);
    $('#pMuf').classList.toggle('on', P.muffler !== false);
    $('#rowBaffle').style.opacity = P.muffler === false ? 0.4 : 1;
    $('#pBaf').value = P.baffle; $('#pBafO').textContent = `${Math.round(P.baffle * 100)}%`;
    $('#pLen').value = P.pipeLen; $('#pLenO').textContent = `${fmt(P.pipeLen, 2)}×`; segOn('#pCam', P.shiftCam); segOn('#pAnim', P.anim); segOn('#pSpark', P.failSpark);
    $('#pLim').value = P.limit; $('#pLimO').textContent = `${fmtInt(P.limit)} rpm`;
    $('#pIdle').value = P.idle; $('#pIdleO').textContent = `${fmtInt(P.idle)} rpm`;
    $('#pIn').value = P.inertia; $('#pInO').textContent = `${fmt(P.inertia, 2)}×`;
    $('#pCr').value = P.cr; $('#pCrO').textContent = `${fmt(P.cr, 1)}:1`;
    $('#pAdv').value = P.advance; $('#pAdvO').textContent = `${P.advance > 0 ? '+' : ''}${fmt(P.advance, 1)}°`;
    $('#pFuel').value = P.fuel; $('#pFuelO').textContent = `${P.fuel >= 1 ? '+' : '−'}${Math.round(Math.abs(P.fuel - 1) * 100)}%`;
    if (E.car) {
      segOn('#pFan', P.fan); segOn('#pThermo', P.thermo);
      $('#pAmb').value = P.amb; $('#pAmbO').textContent = `${P.amb} °C`;
      for (const [id, k] of [['#pRev', 'revMatch'], ['#pLeak', 'failLeak'], ['#pRad', 'failRad'], ['#pBatt', 'failBatt'], ['#pApex', 'failApex']]) $(id).classList.toggle('on', !!P[k]);
      if (E.turbo) { $('#pBoost').value = P.boost; $('#pBoostO').textContent = bar(P.boost); segOn('#pBov', P.bov); }
      if (E.rotary) { segOn('#pPort', P.port); $('#pBeep').classList.toggle('on', P.beep !== false); }
    }
    $('#pKnock').classList.toggle('on', P.knockCtl);
    $('#pDtc').classList.toggle('on', P.dtc);
    $('#pQs').classList.toggle('on', P.qs);
    $('#pFilter').classList.toggle('on', P.failFilter);
    $('#pShake').classList.toggle('on', P.shake !== false);
    const ly = this.app.scene ? this.app.scene.layers : {};
    for (const [id, k] of [['#lyGas', 'gas'], ['#lyFlow', 'flow'], ['#lyLabels', 'labels'], ['#lyValues', 'values']]) $(id).classList.toggle('on', ly[k] !== false);
  }
}
