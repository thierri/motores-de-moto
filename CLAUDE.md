# Simulador de motores de moto (4 em linha, V-Twin e CG 125) — notas para o Claude

Simulador interativo com três motores: 4 em linha (inspirado na S1000RR), V-Twin 45° (inspirado no
Harley-Davidson Milwaukee-Eight 114) e monocilíndrico com carburador (inspirado na Honda CG 125), no
mesmo método da escavadeira e da grua (`documentacao/`, privada). HTML + SVG + JS puro (módulos ES), sem
build. Concepção em `concepcao.md`.

## Regras do projeto

- **Dois formatos**: 16:9 (palco 1920×1080) e 9:16 (1080×1920, celular em pé; `?fmt=916`, tecla F alterna).
  No 9:16 a cena vira abas (`scene.setTab`: motor / dentro / escape), cada uma com um `viewBox` e recorte
  próprios, e os textos da cena são ampliados 1,45× (`setTextScale`). Toda mudança de layout: conferir nos dois.
- **Escapamento**: `P.muffler` (com/sem silencioso), `P.baffle` (abafamento 0–1), `P.pipeLen` (tubos),
  `P.flap` (válvula, só 4 em linha). Os botões Original/Esportivo/Aberto são atalhos de `baffle`.
- **Motores são perfis** em `js/config.js` (`ENGINES.i4`, `ENGINES.v2`, `ENGINES.cg`): geometria, curvas, câmbio, moto e som
  (`snd`). A física recebe o perfil por `profile(P)`; cada motor guarda os próprios parâmetros (`app.Ps`).
  O desenho é por motor: `scene.js` (4 em linha), `scene-v2.js` (V-Twin) e `scene-cg.js` (CG, com o
  carburador por dentro). Painel: `cluster` do perfil ('tft' | 'chrome' | 'classic').
- **Partida** (`startModel` em `engine.js`): cada compressão girando tem uma chance de explodir; o motor pega
  depois de `needFires` explosões. Frio é mais difícil e pode pegar e morrer. Injeção: acelerador todo aberto
  corta a injeção. Carburador (`carb`): afogador (`st.choke`, tecla A); `kick`: pedal de partida (`kick()`).
- **Física separada do desenho**: `js/sim/engine.js` não toca no DOM. Teste com `node tools/testsim.mjs`.
- **Som é a prioridade** e é só sintetizado. O worklet (`js/audio/engine-worklet.js`) integra o próprio
  ângulo do virabrequim a partir do rpm; a física manda rpm, carga, corte e falhas por AudioParams.
  Hierarquia: lenta < médio < plena carga em giro alto < corte. Pico < 0,8 (medir com `sim.sound.level()`).
- **Animação em câmera lenta**: o desenho usa um ângulo visual próprio (`st.vis`), nunca o ângulo real.
- **Modo vídeo determinístico** (`?video`): sem requestAnimationFrame, `Math.random` com semente,
  transições desligadas, som com `sound.clock`. O worklet tem gerador aleatório próprio com semente.
- **Carros** (aba "Carros" no topo; `car: true` no perfil): `t4` (4 cilindros 2.0 turbo, inspirado no Golf GTI),
  `b6` (boxer 6, inspirado no Porsche Boxster S) e `rx` (Wankel de 2 rotores, inspirado no Mazda RX-8).
  Desenho: `scene-t4.js`, `scene-b6.js`, `scene-rx.js` (região da esquerda) e `scene-car.js` (arrefecimento
  na região de cima à direita e escapamento, comuns aos três). `?motor=t4|b6|rx`. Painel `cluster: 'car'`.
  - Arrefecimento (`thermalCar` em `engine.js`): água do motor (`temp.coolant`) e do radiador (`temp.rad`),
    termostática (`st.thermo`, abre a 88 °C), ventoinha (`st.fan`/`st.fanSpd`: liga a 98 °C, desliga a 91 °C,
    2ª velocidade a 105 °C), nível (`st.coolLvl`), fervura (`st.steam`, 120 °C) e junta queimada (128 °C por 8 s).
    Parâmetros: `P.amb`, `P.fan`, `P.thermo`, `P.failLeak`, `P.failRad`. Botões: A/C (`st.ac`, tecla K) e ar
    quente (`st.heater`, tecla A). Conferir os tempos com um roteiro de node antes de mexer nos coeficientes.
  - Turbo: `st.boost` (bar), `st.spool`, `P.boost` (wastegate), `P.bov`; a curva do perfil vale na pressão nominal.
  - Wankel: `cyl` = rotores; o desenho usa `st.vis.long` (o rotor gira a 1/3 do eixo); `localAngle()` dá o
    ângulo do ciclo de qualquer motor. `P.port` (janela ampliada), `P.failApex`. No som são 4 pulsos por ciclo
    (`snd.n`, `snd.units`).
  - Timbre por motor no worklet (opcional em `snd`): `formants` (ressonâncias fixas do escape), `zing` (anel
    metálico a cada explosão), `howl` (admissão que canta numa faixa de giro), `pulse.saw`, ganho por grupo
    (`groups[].g`) e por cilindro (`cylGain`). Para comparar motores sem ouvir, rodar o worklet no node e
    medir ordens e centroide do espectro.
  - **Vista 3D** (protótipo, só no boxer): botão "Ver em 3D" na cena. `js/render3d/stage3d.js` (base: Three.js
    carregado do CDN só ao abrir, órbita, luzes), `boxer3d.js` (o modelo) e `view3d.js` (botão e registro em
    `MODELS`). Usa a mesma física e o mesmo ângulo visual do 2D; fica desligada no modo vídeo.
    No 16:9 a vista ocupa a cena inteira (`scene.set3d` esconde o 2D; o painel fica); no 9:16, a aba do motor.
    O modelo inclui escape (brasa pela temperatura do metal, `exT`), gases e o arrefecimento.
  - Câmbio em H (`shiftCar`), pneus que patinam (`bike.grip`, `st.spin`), punta-tacco (`P.revMatch`).
- Marcas: sem logos da BMW, Harley-Davidson ou Honda. Só os botões do seletor usam os nomes (CG125, Harley
  Davidson, BMW S1000), a pedido; no resto, "inspirado na …". Os carros não usam marca nos botões.
- Ao abrir: CG 125, escape esportivo, desenho em tempo real e a chave piscando até ser ligada.
- Servidor local: `python3 -m http.server 8765` rodado pelo terminal (o macOS bloqueia a pasta Desktop
  para processos iniciados pelo app). Para evitar cache de módulos: `python3 tools/serve.py` (porta 8781).
- **Vídeo** (igual à grua, `documentacao/03-pipeline-video.md`): roteiro em `js/present/scenes.js` (cenas como dados,
  tempos no tempo do vídeo editado), motor em `js/present/presentation.js` (`?apresentacao` roda no navegador).
  `video/edicao.json` tem os cortes da narração (`narracao.m4a`) e as pausas mais longas (`pausas.manter`).
  `python3 -I video/tools/build.py --palavras` lista as palavras de cada cena; `--916` gera os dois projetos.
  Som do motor: `python3 -I video/tools/som.py 8772` e abrir `video/project/index.html?audio` (espera "pronto").
  Render: `npx --yes hyperframes@0.9.23 render video/project -o exports/motores-de-moto-169.mp4` (e `project-916`).
  No roteiro, `st.forceP` fixa se a partida pega e `st.visRpm` fixa a velocidade do desenho (quatro tempos).

