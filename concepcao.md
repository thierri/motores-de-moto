# Concepção: simulador de motor de superbike 4 em linha

Página 1 do método (`documentacao/02-metodo-novas-maquinas.md`, seção 1), aprovada antes do código.

## Decisões

- **Motor 4 cilindros em linha, 4 tempos, 16 válvulas (DOHC)**, números próximos da BMW S1000RR. O site
  não usa marca nem logo: é "um motor de superbike inspirado na S1000RR".
- **Som é a prioridade**: 100% sintetizado (Web Audio + AudioWorklet), ligado à física.
- **Só 16:9** (palco 1920×1080) nesta rodada. 9:16 pode vir depois.
- **Bancada e pista no mesmo simulador**: em neutro o motor gira livre (bancada); engatando uma marcha a
  moto anda (6 marchas, embreagem, quickshifter, freio).
- **Modo apresentação depois**, mas a base do modo vídeo existe desde o começo (`tick`, `resetFx`,
  `Math.random` substituível, `sound.clock`).

## Números de referência

| Item | Valor |
|---|---|
| Cilindrada | 999 cc (diâmetro 80 mm × curso 49,7 mm), biela ~103 mm |
| Compressão | 13,3:1 |
| Potência / torque | ~210 cv a 13.750 rpm / 113 Nm a 11.000 rpm |
| Marcha lenta / corte | 1.250 rpm / 14.600 rpm |
| Ordem de ignição | 1-2-4-3 (virabrequim plano, explosão a cada 180°) |
| Crossplane (opção) | 1-3-2-4, intervalos 270-180-90-180° |
| ShiftCam | ressalto de admissão parcial → pleno em ~9.000 rpm |
| Borboletas | 4 × 48 mm, acelerador eletrônico |
| Relações | primária 1,652 · 2,647 / 2,091 / 1,727 / 1,500 / 1,360 / 1,261 · final 45/17 |
| Moto + piloto | ~272 kg, roda traseira r ≈ 0,32 m |

## Projeção

- **Vista principal**: corte frontal (longitudinal ao virabrequim) com os 4 cilindros lado a lado:
  pistões, bielas, virabrequim, comandos e válvulas. Gás colorido por pressão, chama na explosão.
- **Detalhe**: corte transversal de um cilindro (clique num cilindro para escolher): borboleta, bico
  injetor, válvulas de admissão e escape, vela, coletor de escape.
- **Roda de 720°**: em que tempo está cada cilindro.
- **Escape 4-2-1**: pulsos andando pelos tubos, cor = temperatura.
- **Câmera lenta visual**: a animação gira devagar (curva não linear da rotação), o som é em tempo real.
  Opção "tempo real" (efeito estroboscópico).

## Cadeia de energia

```
ar → borboletas → coletor (vácuo) → válvulas → cilindro (+ combustível) → combustão → pistão → biela
→ virabrequim → volante → embreagem → câmbio → corrente → roda → asfalto
proteções: corte de giro, sensor de detonação, controle de tração, ventoinha
```

## Física (quase-estática, `js/sim/engine.js`)

- Pressão no coletor pelo equilíbrio de vazões (borboleta = cilindros), resolvida por bissecção.
- Torque indicado = curva de plena carga (ShiftCam) × pressão no coletor × eficiência (λ, avanço,
  compressão, escape) − atrito − bombeamento.
- Virabrequim: `J·dω/dt = T_motor − T_carga`. Embreagem com atrito limitado (agarra/patina).
- ECU: marcha lenta (PI), corte de giro, corte na desaceleração, quickshifter (corte/blip), controle
  de detonação, controle de tração (limita a ~1 g).
- Pressão no cilindro analítica (biela-manivela + Wiebe) para o desenho e o gráfico.

## Som (`js/audio/`)

- Worklet: pulsos de escape por cilindro → guias de onda 4-2-1 (atrasos com o comprimento dos tubos) →
  silencioso conforme o escapamento → derivada (radiação) → reflexo do chão.
- Admissão (caixa de ar), válvulas, corrente, detonação (anel a ~6,6 kHz), pipocos na desaceleração.
- Fora do worklet: motor de partida, bomba de combustível, câmbio, vento e pneus, ventoinha.
- Hierarquia: lenta < médio < plena carga em giro alto < corte. Pico < 0,8.

## Demonstrações-chave

1. A partida e a marcha lenta irregular.
2. Acelerar até o corte: o grito a 14.000 rpm e o corte batendo.
3. Plano × crossplane: o mesmo motor, outro som.
4. Trocas com quickshifter na pista.
5. Detonação: avanço demais acende a luz e o som "pinga".
