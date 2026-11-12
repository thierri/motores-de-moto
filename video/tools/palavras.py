# Junta os tokens do whisper-cli (-dtw) em palavras com tempo de início, e lista com as pausas do áudio.
# Uso: python3 -I video/tools/palavras.py [t0 t1]
import json, sys, os
B = os.path.join(os.path.dirname(__file__), '..', 'build')
d = json.load(open(os.path.join(B, 'narracao.json'), encoding='utf-8'))
env = json.load(open(os.path.join(B, 'env.json')))
W = []
for seg in d['transcription']:
    for k in seg['tokens']:
        t = k['text']
        if t.startswith('[') or k['t_dtw'] < 0: continue
        s = k['t_dtw'] / 100
        if t.startswith(' ') or not W: W.append({'w': t.strip(), 's': s})
        else: W[-1]['w'] += t
json.dump(W, open(os.path.join(B, 'palavras.json'), 'w', encoding='utf-8'), ensure_ascii=False)
t0, t1 = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (0, 1e9)
sil, run = [], 0
for i, v in enumerate(env):
    if v < -42: run += 1
    else:
        if run >= 30: sil.append(((i - run) / 100, i / 100))
        run = 0
out, si = [], 0
for w in W:
    while si < len(sil) and sil[si][0] <= w['s']:
        a, b = sil[si]
        if t0 <= a <= t1: out.append(f"‖{a:.2f}-{b:.2f}")
        si += 1
    if t0 <= w['s'] <= t1: out.append(f"{w['w']}@{w['s']:.2f}")
print(' '.join(out))
