# Simulador de motores de moto: 4 em linha e V-Twin

Simulador interativo com dois motores, escolhidos na barra de cima:

- **4 em linha** (superbike, inspirado na S1000RR): 999 cc, 16 válvulas, ~210 cv a 14.000 rpm, corte em 14.600.
- **V-Twin 45°** (inspirado no Harley-Davidson Milwaukee-Eight 114): 1.868 cc, varetas, 155 Nm a 3.250 rpm,
  ~95 cv, explosões desiguais (315° / 405°) que dão o "batata-batata".

Som 100% sintetizado a partir da física. HTML + SVG + JS puro, sem build. `?motor=v2` abre direto no V-Twin.
Funciona no computador (16:9) e no celular em pé (9:16, escolhido sozinho; `?fmt=916` força, tecla F alterna).

Site: https://thierri.github.io/motores-de-moto/ · repositório `thierri/motores-de-moto`.

## Rodar

```bash
python3 tools/serve.py
```

Abra http://localhost:8781 e clique uma vez para liberar o som (fone de ouvido ajuda muito).

## Comandos

| Ação | Teclado | Controle |
|---|---|---|
| Chave | I | Y |
| Partida (segurar) | Enter | A |
| Corta-corrente | K | — |
| Acelerar aos poucos / tudo | ↑ ou W / Espaço | gatilho direito |
| Manter a posição do acelerador | L (ou roda do mouse na manopla) | — |
| Subir / descer marcha | E / Q | RB / LB |
| Neutro (entre a 1ª e a 2ª) | N | B |
| Embreagem (segurar) | C | X |
| Freio | S ou ↓ | gatilho esquerdo |
| Modo de pilotagem | M | — |
| Ouvir de trás / do piloto | O | — |

Para andar: puxe a embreagem (C), engate a 1ª (Q), acelere um pouco e solte a embreagem.

## Estrutura

```
js/config.js            perfis dos motores (geometria, curvas, câmbio, moto, som) e parâmetros padrão
js/sim/engine.js        física (sem DOM): ar, torque, ECU, embreagem, câmbio, temperaturas
js/audio/engine-worklet.js  síntese do motor: pulsos por cilindro → escape 4-2-1 → silencioso
js/audio/sound.js       grafo Web Audio, partida, bomba, câmbio, vento, eventos
js/audio/offline.js     grava o som offline em WAV (tools/out/) para análise
js/render/scene.js      desenho do 4 em linha (4 cilindros, corte de um cilindro, escape) e roda do ciclo
js/render/scene-v2.js   desenho do V-Twin (corte lateral, varetas, ritmo dos pulsos, escapamento)
js/render/panel.js      painel TFT, números, dinamômetro, pressão no cilindro, luzes
js/ui/                  comandos, textos das peças, gaveta de parâmetros
tools/testsim.mjs       testes da física: node tools/testsim.mjs [i4|v2]
```

Gravar o som offline (console do navegador):

```js
const m = await import('/js/audio/offline.js'); await m.record('teste', m.SCRIPTS.track, { engine: 'v2' })
```
