# Simulador de motores de moto (4 em linha e V-Twin) — notas para o Claude

Simulador interativo com dois motores: 4 em linha (inspirado na S1000RR) e V-Twin 45° (inspirado no
Harley-Davidson Milwaukee-Eight 114), no
mesmo método da escavadeira e da grua (`documentacao/`, privada). HTML + SVG + JS puro (módulos ES), sem
build. Concepção em `concepcao.md`.

## Regras do projeto

- **Dois formatos**: 16:9 (palco 1920×1080) e 9:16 (1080×1920, celular em pé; `?fmt=916`, tecla F alterna).
  No 9:16 a cena vira abas (`scene.setTab`: motor / dentro / escape), cada uma com um `viewBox` e recorte
  próprios, e os textos da cena são ampliados 1,45× (`setTextScale`). Toda mudança de layout: conferir nos dois.
- **Escapamento**: `P.muffler` (com/sem silencioso), `P.baffle` (abafamento 0–1), `P.pipeLen` (tubos),
  `P.flap` (válvula, só 4 em linha). Os botões Original/Esportivo/Aberto são atalhos de `baffle`.
- **Motores são perfis** em `js/config.js` (`ENGINES.i4`, `ENGINES.v2`): geometria, curvas, câmbio, moto e som
  (`snd`). A física recebe o perfil por `profile(P)`; cada motor guarda os próprios parâmetros (`app.Ps`).
  O desenho é por motor: `scene.js` (4 em linha) e `scene-v2.js` (V-Twin); a roda do ciclo é comum.
- **Física separada do desenho**: `js/sim/engine.js` não toca no DOM. Teste com `node tools/testsim.mjs`.
- **Som é a prioridade** e é só sintetizado. O worklet (`js/audio/engine-worklet.js`) integra o próprio
  ângulo do virabrequim a partir do rpm; a física manda rpm, carga, corte e falhas por AudioParams.
  Hierarquia: lenta < médio < plena carga em giro alto < corte. Pico < 0,8 (medir com `sim.sound.level()`).
- **Animação em câmera lenta**: o desenho usa um ângulo visual próprio (`st.vis`), nunca o ângulo real.
- **Modo vídeo determinístico** (`?video`): sem requestAnimationFrame, `Math.random` com semente,
  transições desligadas, som com `sound.clock`. O worklet tem gerador aleatório próprio com semente.
- Marcas: sem logos da BMW ou da Harley-Davidson; "inspirado na S1000RR" / "inspirado no Milwaukee-Eight" é o máximo.
- Servidor local: `python3 -m http.server 8765` rodado pelo terminal (o macOS bloqueia a pasta Desktop
  para processos iniciados pelo app). Para evitar cache de módulos: `python3 tools/serve.py` (porta 8781).
