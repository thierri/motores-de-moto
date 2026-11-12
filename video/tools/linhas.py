# Lista a transcrição em frases, quebrando nos silêncios (lê video/build/<json> do whisper-cli e o wav 16 kHz).
# Uso: python3 -I video/tools/linhas.py narracao2.json
import json, sys, array, math, os
B = os.path.join(os.path.dirname(__file__), '..', 'build')
d = json.load(open(os.path.join(B, sys.argv[1]), encoding='utf-8'))
words = []
for s in d['transcription']:
    t = s['text'].strip()
    if t: words.append([s['offsets']['from'] / 1000, s['offsets']['to'] / 1000, t])
envf = os.path.join(B, 'env.json')
if not os.path.exists(envf):
    raw = open(os.path.join(B, 'narracao16k.wav'), 'rb').read()[44:]
    a = array.array('h'); a.frombytes(raw)
    env = []
    for i in range(0, len(a) - 160, 160):
        seg = a[i:i + 160]
        env.append(20 * math.log10(math.sqrt(sum(x * x for x in seg) / 160) / 32768 + 1e-9))
    json.dump(env, open(envf, 'w'))
env = json.load(open(envf))
json.dump([{'w': w, 's': s, 'e': e} for s, e, w in words], open(os.path.join(B, 'palavras.json'), 'w', encoding='utf-8'), ensure_ascii=False)
def silent(t0, t1):
    run = best = 0
    for v in env[int(t0 * 100):int(t1 * 100)]:
        run = run + 1 if v < -42 else 0; best = max(best, run)
    return best >= 40
out, line, ls, prev = [], [], None, None
for s, e, w in words:
    if prev is not None and (s - prev > 0.6 or silent(prev, s)):
        out.append(f"[{ls:6.2f}-{prev:6.2f}] " + ' '.join(line)); line = []; ls = None
    if ls is None: ls = s
    line.append(w); prev = e
out.append(f"[{ls:6.2f}-{prev:6.2f}] " + ' '.join(line))
print('\n'.join(out))
