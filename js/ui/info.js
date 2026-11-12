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

// textos da CG 125 (monocilíndrico com carburador)
const T3 = {
  piston: ['Pistão', 'Um só, de 56,5 mm de diâmetro. É pequeno e leve, mas sozinho: entre uma explosão e outra o motor depende do volante para continuar girando.',
    (s) => `velocidade média ${fmt(2 * 0.0495 * s.rpm / 60, 1)} m/s`],
  rod: ['Biela', 'Liga o pistão ao virabrequim. Num monocilíndrico ela trabalha sozinha, e o motor vibra mais: não há outro pistão para equilibrar o movimento.'],
  crank: ['Volante do magneto', 'O virabrequim tem um volante pesado na ponta, com ímãs (o magneto) que geram a eletricidade da moto. O peso guarda energia para as três voltas e meia em que o motor não explode.',
    (s) => `${fmtInt(s.rpm)} rpm`],
  cylinder: ['Cilindro', 'Um cilindro de 124 cc, inclinado para frente e com aletas para o vento esfriar.'],
  chamber: ['Câmara de combustão', 'A cor mostra a pressão do gás. Uma explosão a cada duas voltas: na lenta, você quase consegue contar.'],
  head: ['Cabeçote', 'Só duas válvulas, uma de admissão e uma de escape, abertas por balancins. Simples, barato de manter e muito durável.'],
  fins: ['Aletas', 'Arrefecimento a ar: o vento passando pelas aletas leva o calor. Parada no trânsito, ela esquenta.', (s) => `óleo ${Math.round(s.temp.coolant)} °C`],
  crankcase: ['Cárter', 'A mesma carcaça guarda o virabrequim, o comando, o câmbio e o óleo.'],
  oil: ['Óleo', 'Lubrifica o motor e o câmbio, que dividem o mesmo óleo.', (s) => `${fmt(s.oilP, 1)} bar · ${Math.round(s.temp.oil)} °C`],
  camV2: ['Comando no cárter', 'Um eixo com dois ressaltos, girando na metade da rotação do motor. Ele empurra os tuchos, que empurram as varetas.'],
  lifter: ['Tuchos', 'Seguem os ressaltos do comando. São mecânicos: a folga é regulada na mão, e o "tec-tec" do cabeçote é a cara da CG.'],
  pushrod: ['Varetas', 'Levam o movimento do comando, lá embaixo, até os balancins, lá em cima. É o motor OHV clássico.'],
  rocker: ['Balancins', 'Alavancas no cabeçote: a vareta empurra um lado e o outro abre a válvula.'],
  valveIn: ['Válvula de admissão', 'Deixa entrar a mistura de ar e gasolina que vem do carburador.'],
  valveEx: ['Válvula de escape', 'Solta o gás queimado para o escapamento.'],
  spark: ['Vela', 'Uma vela, acionada pela ignição eletrônica (CDI) alimentada pelo magneto.', (s) => `avanço ${fmt(s.adv, 0)}° antes do PMS`],
  intake: ['Coletor de admissão', 'Leva a mistura do carburador ao cabeçote. A cor mostra a pressão.', (s) => `${Math.round(s.pr * 101.3)} kPa`],
  carb: ['Carburador', 'Não há injeção eletrônica: o próprio ar passando puxa a gasolina. A manopla puxa um cabo que sobe a gaveta e deixa passar mais ar. Veja na aba de cima à direita como ele funciona por dentro.',
    (s) => `gaveta ${Math.round(s.tps * 100)}% · λ ${fmt(s.lambda, 2)}`],
  venturi: ['Venturi', 'O estreitamento do duto. Ali o ar acelera e a pressão cai: é essa queda que puxa a gasolina para cima pelo giclê.'],
  slide: ['Gaveta (pistonete)', 'Sobe e desce com a manopla, abrindo ou fechando a passagem do ar. Ela carrega a agulha junto.'],
  needle: ['Agulha', 'Cônica, presa na gaveta. Quanto mais a gaveta sobe, mais a agulha sai do giclê e mais gasolina passa.'],
  jet: ['Giclê', 'Um furo calibrado por onde a gasolina sobe da cuba. O tamanho dele decide quanta gasolina a moto recebe em alta.'],
  bowl: ['Cuba', 'Um pequeno reservatório de gasolina embaixo do carburador, sempre no mesmo nível.'],
  float: ['Boia', 'Flutua na gasolina e fecha a entrada de combustível quando a cuba enche, como a boia de uma caixa-d\'água.'],
  choke: ['Afogador', 'Uma borboleta na entrada de ar. Fechada, deixa passar pouco ar e a mistura fica rica: é o que o motor frio precisa para pegar. Com o motor quente, ela afoga o motor. Tecla A.',
    (s) => `afogador ${s.choke ? 'ligado' : 'desligado'}`],
  airbox: ['Filtro de ar', 'Segura a poeira antes do carburador.'],
  filter: ['Filtro de ar', 'Entupido, a mistura fica rica e a moto perde força.'],
  gearbox: ['Câmbio', 'Cinco marchas, no mesmo bloco do motor. As engrenagens só giram com a moto engatada.', (s) => (s.gear ? `${s.gear}ª marcha` : 'neutro')],
  kick: ['Pedal de partida', 'A CG clássica não tem motor de arranque: um chute no pedal gira o motor e, se a mistura estiver boa, ele pega. Toque em Partida (ou Enter) para dar uma pedalada.'],
  header: ['Escapamento', 'Um tubo comprido sai pela frente do cabeçote e corre por baixo do motor.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escapamento', 'Um tubo só, com o silencioso no fim. O som de uma explosão a cada duas voltas é o "pop-pop" típico das motos pequenas.'],
  muffler: ['Silencioso', 'Abafa o som. A ponteira aberta deixa o "pop-pop" mais alto e estalado.'],
};
const DEFAULT3 = ['Como usar', 'Ligue a chave (I). Com o motor frio, ligue o afogador (A) e dê pedaladas (Enter ou o botão Pedal) até pegar. Depois que esquentar, desligue o afogador. Para andar: embreagem (C), 1ª (Q) e solte a embreagem acelerando. Clique em qualquer peça.'];

// ---------- carros ----------
// textos comuns aos três (arrefecimento, turbo, peças básicas); cada motor sobrepõe os seus
const TC = {
  piston: ['Pistão', 'Recebe a força da explosão e a passa para a biela. Num motor de carro ele tem curso mais longo que o de uma superbike: gira menos, mas empurra com mais força em baixa rotação.'],
  rod: ['Biela', 'Liga o pistão ao virabrequim e transforma o vai e vem em giro.'],
  crank: ['Virabrequim', 'O eixo que gira e leva a força para o câmbio. Na ponta dele vai o volante, um disco pesado que deixa a rotação mais lisa e onde a embreagem encosta.', (s) => `${fmtInt(s.rpm)} rpm`],
  bearing: ['Mancais', 'Apoios do virabrequim. O eixo gira sobre uma película de óleo sob pressão e quase não encosta no metal.', (s) => `óleo ${fmt(s.oilP, 1)} bar`],
  cylinder: ['Cilindro', 'O tubo onde o pistão corre. Clique num cilindro para ver a pressão dele no painel.'],
  chamber: ['Câmara de combustão', 'A cor mostra a pressão do gás: azul é vácuo na admissão, vermelho é a explosão.'],
  head: ['Cabeçote', 'A tampa dos cilindros, com as válvulas, os comandos e as velas. É a peça que mais sofre quando o motor ferve: o alumínio empena e a junta queima.'],
  block: ['Bloco', 'O corpo do motor. Em volta dos cilindros há canais por onde corre a água de arrefecimento.', (s) => `água ${Math.round(s.temp.coolant)} °C`],
  crankcase: ['Cárter', 'A parte de baixo do motor, onde gira o virabrequim e fica o óleo.'],
  oil: ['Óleo', 'Lubrifica e também ajuda a tirar calor de dentro do motor. Frio, ele é grosso e a pressão sobe; quente demais, afina e protege menos.', (s) => `${fmt(s.oilP, 1)} bar · ${Math.round(s.temp.oil)} °C`],
  camIn: ['Comando de admissão', 'Eixo com ressaltos que abrem as válvulas de admissão. Gira na metade da rotação do virabrequim.'],
  camEx: ['Comando de escape', 'O mesmo, para as válvulas de escape.'],
  valveIn: ['Válvulas de admissão', 'Abrem para o ar entrar enquanto o pistão desce.'],
  valveEx: ['Válvulas de escape', 'Abrem para o gás queimado sair. É desse sopro que nasce o som do escapamento.'],
  spark: ['Vela', 'Solta a faísca um pouco antes de o pistão chegar em cima. Se o motor começa a detonar, a central atrasa a faísca para protegê-lo.',
    (s) => `avanço ${fmt(s.adv, 0)}° antes do PMS${s.retard > 0.2 ? ` (−${fmt(s.retard, 1)}° pelo sensor)` : ''}`],
  intake: ['Admissão', 'O caminho do ar até os cilindros. A cor mostra a pressão: azul é vácuo (borboleta fechada).', (s) => `${Math.round(s.map * 101.3)} kPa`],
  throttle: ['Borboleta', 'O disco que regula quanto ar entra. O pedal manda um sinal e um motor elétrico gira a borboleta.', (s) => `pedal ${Math.round(s.input.grip * 100)}% → borboleta ${Math.round(s.tps * 100)}%`],
  airbox: ['Filtro de ar', 'Segura a poeira antes de o ar entrar no motor.'],
  filter: ['Filtro de ar', 'Entupido, ele restringe o ar e o motor perde força em alta rotação.'],
  header: ['Coletor de escape', 'Leva o gás queimado para fora. A cor mostra a temperatura.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escapamento', 'Os tubos de cada cilindro se juntam e seguem até o silencioso, lá atrás. O comprimento dos tubos afina o som.'],
  muffler: ['Silencioso', 'Abafa o som. O original é grande e cheio de câmaras; o esportivo deixa passar mais ronco; o direto quase não abafa.'],
  // arrefecimento
  coolant: ['Água de arrefecimento', 'Só um terço da energia da gasolina vira movimento; outro terço vira calor nas paredes do motor. A água (com aditivo) passa em volta dos cilindros e leva esse calor embora. A cor mostra a temperatura.',
    (s) => `motor ${Math.round(s.temp.coolant)} °C · radiador ${Math.round(s.temp.rad)} °C`],
  radiator: ['Radiador', 'Centenas de tubinhos finos com aletas. A água quente entra por cima, perde calor para o ar que atravessa a colmeia e sai fria por baixo. Na estrada o próprio vento resolve; parado, só a ventoinha.',
    (s) => `${Math.round(s.temp.rad)} °C · ar ${Math.round(s.temp.amb)} °C · vento ${Math.round(s.v * 3.6)} km/h`],
  fan: ['Ventoinha', 'Um ventilador elétrico atrás do radiador. Parado no trânsito não há vento, então a central liga a ventoinha quando a água passa de 98 °C e desliga quando ela volta a 91 °C. Acima de 105 °C entra a segunda velocidade. Com o ar-condicionado ligado ela fica ligada.',
    (s) => (s.fan && s.key ? (s.fanSpd > 1.2 ? 'ligada na 2ª velocidade' : 'ligada') : 'desligada')],
  thermostat: ['Válvula termostática', 'Uma válvula com cera dentro. Fria, ela fica fechada e a água circula só dentro do motor, para ele esquentar depressa. Perto de 88 °C a cera derrete, expande e abre a passagem para o radiador.',
    (s) => `aberta ${Math.round(s.thermo * 100)}%`],
  waterPump: ['Bomba d\'água', 'Empurra a água pelo motor e pelo radiador. É girada pelo próprio motor: quanto mais giro, mais água circula.'],
  hoses: ['Mangueiras do radiador', 'A de cima leva a água quente do motor para o radiador; a de baixo traz a água já resfriada de volta para a bomba.'],
  bypass: ['Desvio', 'Com a termostática fechada, a água volta direto para a bomba sem passar pelo radiador. É assim que o motor esquenta rápido.'],
  expTank: ['Reservatório de expansão', 'A água quente ocupa mais espaço; o excesso vai para este reservatório. O sistema é pressurizado, e por isso a água só ferve perto de 120 °C. Se ferver, o vapor sai por aqui e o nível cai.',
    (s) => `nível ${Math.round(s.coolLvl * 100)}%`],
  heaterCore: ['Ar quente', 'Um radiador pequeno dentro do painel: o ar da cabine passa por ele e esquenta. Truque de emergência: se o motor estiver superaquecendo, ligar o ar quente no máximo ajuda a tirar calor da água.',
    (s) => (s.heater ? 'ligado: tirando calor do motor' : 'desligado')],
};

const T_T4 = {
  cylinder: ['Cilindro', 'São 4 em linha, com 82,5 mm de diâmetro e 92,8 mm de curso. Clique num cilindro para ver a pressão dele no painel.'],
  chamber: ['Câmara de combustão', 'A cor mostra a pressão. Com o turbo soprando, o cilindro já começa a compressão com o dobro do ar, e a explosão passa de 100 bar.'],
  injector: ['Injeção direta', 'O bico pulveriza a gasolina dentro do cilindro, a mais de 100 bar. A gasolina evaporando esfria a mistura, e é isso que deixa o motor turbo usar bastante pressão sem detonar.',
    (s) => `λ ${fmt(s.lambda, 2)} · ${fmt(s.fuelLh, 1)} L/h`],
  turbine: ['Turbina (lado quente)', 'O gás de escape, que iria embora, gira esta roda a mais de 150.000 rpm. Ela fica vermelha de quente em uso forte. Abaixo de ~1.500 rpm quase não há gás para girá-la: é o "lag" do turbo.',
    (s) => `${fmtInt(Math.round(s.spool * 170) * 1000)} rpm · gás a ${Math.round(s.temp.egt)} °C`],
  compressor: ['Compressor (lado frio)', 'No mesmo eixo da turbina, esta roda puxa o ar do filtro e o empurra comprimido para o motor. Mais ar no cilindro, mais gasolina queimada, mais força: um 2.0 rende como um 3.5.',
    (s) => `+${fmt(Math.max(0, s.boost), 2)} bar · coletor ${Math.round(s.map * 101.3)} kPa`],
  turboShaft: ['Eixo do turbo', 'Liga a turbina ao compressor e gira flutuando em óleo do motor. Por isso não se desliga um turbo logo depois de andar forte: o óleo parado cozinha no eixo quente.'],
  intercooler: ['Intercooler', 'Comprimir o ar esquenta o ar. Este radiador esfria o ar antes de ele entrar no motor: ar frio é mais denso e detona menos.'],
  wastegate: ['Wastegate', 'Uma portinhola que desvia parte do gás por fora da turbina. Quando a pressão chega ao valor desejado ela abre, e a turbina para de acelerar. É ela que define a pressão do turbo.',
    (s, P) => `alvo ${fmt(P.boost, 2)} bar · agora ${fmt(Math.max(0, s.boost), 2)} bar`],
  bov: ['Válvula de alívio', 'Ao tirar o pé, a borboleta fecha e o ar comprimido fica sem saída. Esta válvula abre e o solta: é o "pshhh" dos carros turbo.'],
  intake: ['Tubo de pressão', 'Leva o ar comprimido do compressor, pelo intercooler, até o motor. A cor mostra a pressão: laranja e vermelho são o turbo trabalhando.', (s) => `${Math.round(s.map * 101.3)} kPa`],
  header: ['Coletor de escape', 'Junta o gás dos 4 cilindros e o joga na turbina. A cor mostra a temperatura.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escape 4 em 1 com turbina', 'Os 4 tubos se juntam logo na saída do cabeçote e o gás passa pela turbina, que rouba parte da energia e alisa os pulsos. Por isso um motor turbo soa mais abafado e grave.'],
};
const DEF_T4 = ['Como usar', 'Ligue a chave (I) e segure a partida (Enter). Acelere com ↑ ou Espaço e veja o turbo encher. Para andar: embreagem (C), 1ª (E) e solte a embreagem acelerando. Deixe o carro parado e observe a água esquentar, a termostática abrir e a ventoinha ligar. Clique em qualquer peça.'];

const T_B6 = {
  piston: ['Pistões opostos', 'Cada pistão tem um par do outro lado, que faz o movimento espelhado: os dois saem e voltam ao mesmo tempo. As forças se anulam e o motor quase não vibra, sem precisar de eixos balanceadores.'],
  rod: ['Biela', 'No boxer cada biela tem o próprio moente, a 180° do moente do pistão oposto. É isso que o diferencia de um V a 180°, em que dois pistões dividem o mesmo moente.'],
  crank: ['Virabrequim', 'Curto e rígido, com 6 moentes e 7 mancais. Como o motor é deitado, ele fica bem baixo no carro, e o centro de gravidade também.', (s) => `${fmtInt(s.rpm)} rpm`],
  cylinder: ['Cilindro', 'São 6, deitados: 3 de cada lado, com 97 mm de diâmetro e 78 mm de curso. Clique num cilindro para ver a pressão dele no painel.'],
  head: ['Cabeçotes', 'Dois cabeçotes, um em cada ponta, cada um com 2 comandos e 12 válvulas. O motor fica largo e baixo.'],
  crankcase: ['Cárter', 'O bloco é dividido ao meio, na vertical, e abraça o virabrequim.'],
  exhaustSys: ['Escape 3 em 1 de cada lado', 'Cada bancada tem o próprio coletor. As explosões de uma bancada vêm a cada 240°, igualmente espaçadas: é daí o uivo liso e metálico do seis cilindros boxer.'],
};
const DEF_B6 = ['Como usar', 'Ligue a chave (I) e segure a partida (Enter). Acelere com ↑ ou Espaço e ouça o seis cilindros subir até 7.500 rpm. Para andar: embreagem (C), 1ª (E) e solte a embreagem acelerando. Parado, observe a água esquentar e a ventoinha ligar. Clique em qualquer peça.'];

const T_RX = {
  rotor: ['Rotor', 'Um triângulo de lados abaulados que faz o papel do pistão. Cada um dos três lados forma uma câmara com a parede, e as três fazem o ciclo ao mesmo tempo, defasadas: sempre há uma em admissão, uma comprimindo ou queimando e uma em escape.',
    (s) => `rotor ${fmtInt(s.rpm / 3)} rpm · eixo ${fmtInt(s.rpm)} rpm`],
  housing: ['Carcaça', 'A parede em forma de 8 gordo (uma epitrocoide). As pontas do rotor nunca saem dela. Admissão e escape são simples janelas na parede: não há válvulas, comandos nem molas.'],
  chamber: ['Câmara', 'O espaço entre um lado do rotor e a carcaça. Ele cresce (admissão), encolhe (compressão), cresce de novo (explosão) e encolhe (escape) enquanto o rotor dá uma volta. A cor mostra a pressão.'],
  apex: ['Vedações de ápice', 'Lâminas nas três pontas do rotor, que raspam a carcaça e separam as câmaras, como os anéis de um pistão. São o ponto fraco do Wankel: gastam, e o motor perde compressão.'],
  eshaft: ['Eixo excêntrico', 'É o "virabrequim" do Wankel. O rotor gira em volta de um ressalto fora de centro (a linha amarela) e o empurra em círculo. O eixo dá 3 voltas para cada volta do rotor, e por isso o motor gira tão alto e tão liso.',
    (s) => `${fmtInt(s.rpm)} rpm`],
  statGear: ['Engrenagem fixa', 'Presa na carcaça, não gira. A engrenagem interna do rotor rola em volta dela, e é isso que obriga o rotor a girar no ritmo certo, 1 volta para cada 3 do eixo.'],
  rotorGear: ['Engrenagem do rotor', 'Dentes por dentro do rotor, que rolam em volta da engrenagem fixa.'],
  spark: ['Velas (duas por rotor)', 'A câmara do Wankel é comprida e fina, e a queima é lenta. Duas velas, uma depois da outra, ajudam a queimar tudo. Mesmo assim sobra gasolina sem queimar: o rotativo gasta mais e solta fogo pelo escape.',
    (s) => `avanço ${fmt(s.adv, 0)}°`],
  coolant: ['Água na carcaça', 'A carcaça esquenta sempre no mesmo lugar (o lado das velas, onde acontece a queima) e fica fria no lado da admissão. A água corre por dentro da parede para igualar. Um rotativo superaquecido empena a carcaça e está perdido.',
    (s) => `motor ${Math.round(s.temp.coolant)} °C · radiador ${Math.round(s.temp.rad)} °C`],
  intake: ['Janela de admissão', 'Um buraco na carcaça. O rotor passa, destampa a janela e a câmara, crescendo, puxa a mistura. A cor mostra a pressão.', (s) => `${Math.round(s.map * 101.3)} kPa`],
  header: ['Janela de escape', 'Quando a ponta do rotor passa por ela, o gás ainda em alta pressão sai de uma vez. Sem válvula para segurar, o escape do Wankel é muito quente e muito barulhento.', (s) => `${Math.round(s.temp.egt)} °C`],
  exhaustSys: ['Escapamento', 'Um tubo por rotor. Cada rotor explode uma vez por volta do eixo, então 2 rotores soam no ritmo de um 4 cilindros, só que com pulsos mais secos: o zumbido agudo típico do rotativo.'],
};
const DEF_RX = ['Como usar', 'Ligue a chave (I) e segure a partida (Enter). Acelere com ↑ ou Espaço: o Wankel sobe liso até 9.000 rpm. Clique no rotor pequeno para trocar de rotor. Para andar: embreagem (C), 1ª (E) e solte a embreagem acelerando. Em Parâmetros, experimente a janela ampliada. Clique em qualquer peça.'];
const CAR_T = { t4: [T_T4, DEF_T4], b6: [T_B6, DEF_B6], rx: [T_RX, DEF_RX] };

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
    const cg = P && P.engine === 'cg';
    const car = P && CAR_T[P.engine];
    const [h, p, live] = car ? (car[0][this.sel] || TC[this.sel] || car[1])
      : (cg ? T3[this.sel] : null) || (v2 ? T2[this.sel] : null) || T[this.sel] || (cg ? DEFAULT3 : v2 ? DEFAULT2 : DEFAULT);
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
