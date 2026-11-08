// Painel de informação: o que é cada peça (2 ou 3 frases, com um "porquê") e valores ao vivo.
import { fmt, fmtInt } from '../render/svg.js';
import { profile } from '../config.js';

const T = {
  piston: ['Pistão', 'Recebe a força da explosão e a passa para a biela. Num motor de superbike ele é baixinho e leve: a 14.000 rpm sobe e desce 233 vezes por segundo, chegando a mais de 25 m/s no meio do curso.',
    (s) => `velocidade média ${fmt(2 * 0.0497 * s.rpm / 60, 1)} m/s`],
  rod: ['Biela', 'Liga o pistão ao virabrequim e transforma o vai e vem em giro. Em motores assim ela costuma ser de titânio, para pesar pouco e aguentar a força de dezenas de quilos multiplicada pela aceleração.'],
  crank: ['Virabrequim', 'O eixo que gira. No plano (180°) os pistões 1 e 4 sobem juntos e o 2 e o 3 descem juntos, e as explosões vêm a cada meia volta: é o "grito" liso de um 4 em linha. No crossplane os moentes ficam a 90° e as explosões chegam em intervalos desiguais.',
    (s, P) => `${fmtInt(s.rpm)} rpm · ${P.crank === 'cross' ? 'crossplane' : 'plano'} · ordem ${profile(P).order[P.crank]}`],
  bearing: ['Mancais', 'Apoios do virabrequim, banhados em óleo sob pressão. O eixo gira sobre uma película de óleo e quase não encosta no metal.', (s) => `óleo ${fmt(s.oilP, 1)} bar`],
  cylinder: ['Cilindro', 'O tubo onde o pistão corre. São 4, com 80 mm de diâmetro e 49,7 mm de curso: um motor "superquadrado", de curso curto, feito para girar alto. Clique num cilindro para vê-lo por dentro.'],
  chamber: ['Câmara de combustão', 'O espaço acima do pistão. A cor mostra a pressão do gás: azul é vácuo na admissão, vermelho é a explosão, que passa de 80 bar a plena carga.'],
  head: ['Cabeçote', 'A tampa dos cilindros, com as válvulas, os comandos e as velas. São 16 válvulas: 2 de admissão e 2 de escape por cilindro, que deixam o ar entrar e sair rápido.'],
  block: ['Bloco', 'Alumínio fundido com os 4 cilindros. Em volta dos cilindros corre a água de arrefecimento (a cor mostra a temperatura).', (s) => `água ${Math.round(s.temp.coolant)} °C`],
  coolant: ['Água de arrefecimento', 'Leva o calor das paredes dos cilindros até o radiador. A válvula termostática só abre para o radiador acima de ~82 °C; a ventoinha liga acima de 101 °C. Aqui o aquecimento é acelerado.',
    (s) => `${Math.round(s.temp.coolant)} °C · ventoinha ${s.fan ? 'ligada' : 'desligada'}`],
  crankcase: ['Cárter', 'A caixa de baixo, onde gira o virabrequim. O câmbio fica logo atrás, na mesma peça.'],
  oil: ['Óleo', 'Fica no fundo do cárter. A bomba manda óleo sob pressão para os mancais, para os comandos e para baixo dos pistões, que também são resfriados por ele.', (s) => `${fmt(s.oilP, 1)} bar · ${Math.round(s.temp.oil)} °C`],
  chain: ['Corrente de comando', 'Liga o virabrequim aos dois comandos de válvulas. A engrenagem do comando tem o dobro de dentes, então ele gira na metade da rotação: cada válvula abre uma vez a cada duas voltas.'],
  camIn: ['Comando de admissão (ShiftCam)', 'Um eixo com ressaltos que empurram as válvulas de admissão. No ShiftCam ele tem dois perfis: o parcial, que abre menos (bom em baixa e na economia), e o pleno, que abre mais e por mais tempo (potência em alta). A troca acontece por volta de 9.000 rpm.',
    (s) => `ressalto ${s.cam > 0.5 ? 'pleno' : 'parcial'}`],
  camEx: ['Comando de escape', 'O mesmo princípio, para as válvulas de escape. Os comandos giram em sincronia com o virabrequim, na metade da rotação dele.'],
  valveIn: ['Válvulas de admissão', 'Abrem para o ar com combustível entrar durante a descida do pistão. São maiores que as de escape, porque é mais difícil "puxar" o ar do que empurrar o gás quente para fora.'],
  valveEx: ['Válvulas de escape', 'Abrem um pouco antes do pistão chegar embaixo na explosão, para aproveitar a própria pressão do gás para sair. É desse "sopro" que nasce o som do escape.'],
  spark: ['Vela', 'Solta a faísca alguns graus antes do pistão chegar em cima, para a queima chegar ao pico logo depois. Quanto mais rápido o motor gira, mais cedo ela precisa disparar.',
    (s) => `avanço ${fmt(s.adv, 0)}° antes do PMS${s.retard > 0.2 ? ` (−${fmt(s.retard, 1)}° pelo sensor)` : ''}`],
  injector: ['Bico injetor', 'Pulveriza a gasolina no duto de admissão, logo antes da válvula. A central calcula a quantidade a partir do ar que entra, mirando a mistura certa (λ).',
    (s) => `λ ${fmt(s.lambda, 2)} · ${fmt(s.fuelLh, 1)} L/h`],
  throttle: ['Borboleta (acelerador eletrônico)', 'Uma válvula em forma de disco que regula o ar. Não há cabo: a manopla manda um sinal e um motor elétrico gira a borboleta conforme o modo escolhido.',
    (s) => `manopla ${Math.round(s.input.grip * 100)}% → borboleta ${Math.round(s.tps * 100)}%`],
  intake: ['Duto de admissão', 'Leva o ar da caixa até a válvula. A cor mostra a pressão: com a borboleta quase fechada fica um vácuo forte (azul), e é por isso que o motor "segura" quando você solta o acelerador.',
    (s) => `${Math.round(s.pr * 101.3)} kPa (${Math.round((1 - s.pr) * 100)}% de vácuo)`],
  airbox: ['Caixa de ar e filtro', 'Acalma o ar e filtra a poeira. O volume da caixa também ressoa com os pulsos de admissão: é o rugido que o piloto escuta a plena carga.'],
  filter: ['Filtro de ar', 'Segura a poeira. Entupido, ele restringe o ar e a potência cai em alta rotação.'],
  header: ['Coletor de escape', 'O tubo que sai do cabeçote. A cor mostra a temperatura do gás, que passa de 900 °C a plena carga.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escape 4-2-1', 'Os 4 tubos se juntam em 2 (cilindros 1+4 e 2+3, que explodem a 360° um do outro) e depois em 1. O comprimento de cada tubo afina o som e ajuda a puxar o gás para fora.'],
  muffler: ['Silencioso', 'Abafa o som. O original tem uma válvula que abre em alta rotação; o esportivo é mais curto e vazado; o aberto quase não abafa nada.'],
  wheel: ['Ciclo de 720°', 'Cada anel é um cilindro. Um ciclo completo (admissão, compressão, explosão e escape) leva duas voltas do virabrequim. Repare que sempre há um cilindro em explosão.'],
};

// textos do V-Twin (sobrepõem os do 4 em linha quando o motor é o 'v2')
const T2 = {
  piston: ['Pistão', 'Bem maior que o da superbike: 102 mm de diâmetro e 114 mm de curso. Ele é pesado e anda devagar; a 5.000 rpm faz cerca de 19 m/s de velocidade média.',
    (s) => `velocidade média ${fmt(2 * 0.1143 * s.rpm / 60, 1)} m/s`],
  rod: ['Bielas "garfo e lâmina"', 'As duas bielas usam o mesmo moente. A do cilindro dianteiro termina em forma de garfo e a do traseiro, uma lâmina, entra no meio dele. Assim os dois cilindros ficam alinhados, um atrás do outro.'],
  crank: ['Volantes e moente único', 'Dois discos pesados (volantes) com um só pino entre eles, onde as duas bielas se prendem. O peso dos volantes guarda energia entre as explosões, que no V-Twin são poucas e desiguais.',
    (s) => `${fmtInt(s.rpm)} rpm`],
  cylinder: ['Cilindro', 'São só 2, em V a 45°, com 934 cc cada. Clique no outro cilindro para ver a pressão dele no painel.'],
  chamber: ['Câmara de combustão', 'A cor mostra a pressão do gás. Cada explosão aqui empurra um pistão do tamanho de uma lata de leite condensado: é por isso que o V-Twin tem tanto torque em baixa.'],
  head: ['Cabeçote', 'Duas válvulas de admissão e duas de escape por cilindro (8 no total) e duas velas por cilindro. As válvulas são abertas por balancins, empurrados por varetas que vêm lá de baixo.'],
  fins: ['Aletas', 'Este motor é arrefecido a ar e óleo. As aletas aumentam a área de metal em contato com o vento; parado no trânsito, ele esquenta bem mais.',
    (s) => `óleo/cabeçote ${Math.round(s.temp.coolant)} °C`],
  coolant: ['Aletas', 'Arrefecimento a ar e óleo: o vento passando pelas aletas leva o calor.', (s) => `${Math.round(s.temp.coolant)} °C`],
  crankcase: ['Cárter', 'Guarda os volantes, o comando e a bomba de óleo. O câmbio fica numa caixa separada, atrás, ligado por uma corrente primária.'],
  oil: ['Óleo', 'Além de lubrificar, o óleo ajuda a tirar calor dos cabeçotes, que no Milwaukee-Eight têm canais de óleo perto das válvulas de escape.', (s) => `${fmt(s.oilP, 1)} bar · ${Math.round(s.temp.oil)} °C`],
  camV2: ['Comando no cárter', 'Um só eixo de comando, lá embaixo, perto do virabrequim, com 4 ressaltos (2 por cilindro). Ele gira na metade da rotação do motor e empurra os tuchos.'],
  lifter: ['Tuchos', 'Ficam em cima dos ressaltos do comando e sobem e descem com eles. São hidráulicos: um pouco de óleo dentro deles elimina a folga e o barulho.'],
  pushrod: ['Varetas', 'Hastes compridas que levam o movimento dos tuchos até os balancins, lá em cima. É o desenho clássico "OHV" (válvulas no cabeçote, comando no bloco): simples e compacto, mas pesado para girar alto.'],
  rocker: ['Balancins', 'Alavancas no topo do cabeçote: a vareta empurra uma ponta para cima e a outra ponta empurra a válvula para baixo.'],
  valveIn: ['Válvulas de admissão', 'Ficam do lado de dentro do V, viradas para o coletor de admissão comum aos dois cilindros.'],
  valveEx: ['Válvulas de escape', 'Ficam do lado de fora: o dianteiro solta o gás para frente e o traseiro, para trás. Cada uma tem o seu tubo de escape.'],
  spark: ['Velas (duas por cilindro)', 'Com um pistão tão grande, duas faíscas ao mesmo tempo queimam a mistura mais rápido e por igual.',
    (s) => `avanço ${fmt(s.adv, 0)}° antes do PMS`],
  throttle: ['Corpo de borboleta', 'Uma borboleta só, de 55 mm, alimenta os dois cilindros pelo coletor em Y. Aqui você a vê de frente: aberta, o disco fica de lado.',
    (s) => `manopla ${Math.round(s.input.grip * 100)}% → borboleta ${Math.round(s.tps * 100)}%`],
  intake: ['Coletor de admissão', 'Um Y que leva o ar da borboleta aos dois cilindros. A cor mostra a pressão: azul é vácuo.', (s) => `${Math.round(s.pr * 101.3)} kPa`],
  airbox: ['Filtro de ar', 'Fica do lado direito da moto, no meio do V. Na vista lateral ele aparece transparente, em tracejado, para mostrar o que está atrás.'],
  filter: ['Filtro de ar', 'Entupido, ele restringe o ar e a potência cai em alta.'],
  header: ['Escapamentos', 'Um tubo para cada cilindro. A cor mostra a temperatura do gás.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escapamento', 'Dois tubos, um por cilindro, com um cruzamento que equilibra os pulsos. Os drag pipes são retos e quase sem abafamento.'],
  muffler: ['Silenciosos', 'Abafam o som. Os originais são grandes e fechados; as ponteiras esportivas deixam passar mais grave e mais estalo.'],
  rhythm: ['O ritmo do V-Twin', 'Com os cilindros a 45° e um moente só, as explosões não vêm igualmente espaçadas: 315° e depois 405°. Em giro baixo isso vira o famoso "batata-batata". No 4 em linha as explosões vêm a cada 180°, iguais, e viram um zumbido contínuo.'],
  wheel: ['Ciclo de 720°', 'D é o cilindro dianteiro e T o traseiro. Repare que as explosões (laranja) não estão do lado oposto uma da outra: ficam a 315° de um lado e 405° do outro.'],
};
const DEFAULT2 = ['Como usar', 'Ligue a chave (I), espere a escorva e segure a partida (Enter). Acelere com ↑ ou Espaço e ouça o "batata-batata" na lenta. Para andar: embreagem (C), 1ª (Q) e solte a embreagem. Sem quickshifter, troque com a embreagem. Clique em qualquer peça.'];

const DEFAULT = ['Como usar', 'Ligue a chave (I), espere a bomba de combustível escorvar e segure a partida (Enter). Acelere com ↑ ou Espaço. Para andar: embreagem (C), engate a 1ª (Q) e solte a embreagem acelerando. Clique em qualquer peça para saber o que ela faz.'];

export class Info {
  constructor(box, card) {
    this.box = box;
    this.card = card;
    this.sel = null;
    this.lastLive = '';
    if (card) card.addEventListener('click', (e) => { if (e.target.closest('.x')) { this.sel = null; card.classList.remove('show'); if (this.onClose) this.onClose(); } });
  }

  show(id, st, P) { this.sel = id; this.render(st, P, true); }

  render(st, P, force = false) {
    if (st) this.st = st;
    if (P) this.P = P;
    P = P || this.P;
    if (P && this.eng !== P.engine) { this.eng = P.engine; force = true; }
    st = st || this.st;
    const v2 = P && P.engine === 'v2';
    const [h, p, live] = (v2 ? T2[this.sel] : null) || T[this.sel] || (v2 ? DEFAULT2 : DEFAULT);
    let lv = live && st ? live(st, P) : '';
    if (!this.sel && st && st.msg && st.msgT > 0) lv = st.msg;
    if (!force && lv === this.lastLive) return;
    this.lastLive = lv;
    if (force || this.box.dataset.k !== String(this.sel)) {
      this.box.innerHTML = `<h3>${h}</h3><p>${p}</p><div class="live">${lv}</div>`;
      this.box.dataset.k = String(this.sel);
    } else {
      const e = this.box.querySelector('.live');
      if (e) e.textContent = lv;
    }
    // cartão na cena (9:16): só aparece com uma peça escolhida
    if (this.card) {
      if (this.sel && (force || !this.card.classList.contains('show'))) this.card.innerHTML = `<button class="x">×</button><h3>${h}</h3><p>${p}</p><div class="live">${lv}</div>`;
      else if (this.sel) { const e = this.card.querySelector('.live'); if (e) e.textContent = lv; }
      this.card.classList.toggle('show', !!this.sel);
    }
  }
}
