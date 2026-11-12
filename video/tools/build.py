# Monta o vídeo a partir de video/edicao.json:
#  1. corta e emenda a narração (fades de 12 ms), encurta pausas longas e normaliza em -16 LUFS;
#  2. calcula o início e a duração de cada cena e os pontos de sincronia no tempo do vídeo (timeline.js);
#  3. copia js/ e css/ para project/app-<n>/ e gera index.html (16:9) e, com --916, project-916/;
#  4. se existir build/som-maquina.wav, mixa com ducking em som-maquina.m4a.
# Uso: python3 -I video/tools/build.py [--palavras] [--audio] [--916]
import json, os, sys, shutil, subprocess, time, glob

V = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ROOT = os.path.dirname(V)
B = os.path.join(V, 'build')
E = json.load(open(os.path.join(V, 'edicao.json'), encoding='utf-8'))
FPS = 30


def keep_segments():
    segs = [[E['inicio'], E['fim']]]
    for c in sorted(E['cortes'], key=lambda c: c['de']):
        out = []
        for a, b in segs:
            if c['ate'] <= a or c['de'] >= b: out.append([a, b]); continue
            if c['de'] > a: out.append([a, c['de']])
            if c['ate'] < b: out.append([c['ate'], b])
        segs = out
    # pausas longas: deixa `alvo` segundos (metade de cada lado)
    env = json.load(open(os.path.join(B, 'env.json')))
    p = E['pausas']
    sil, run = [], 0
    for i, v in enumerate(env + [0]):
        if v < p['limite_db']: run += 1
        else:
            if run / 100 >= p['maxima']: sil.append(((i - run) / 100, i / 100))
            run = 0
    # pausas que ficam mais longas (o motor aparece sozinho): [instante dentro da pausa, alvo]
    manter = p.get('manter', [])
    def alvo(s0, s1):
        for t, al in manter:
            if s0 <= t <= s1: return al
        return p['alvo']
    out = []
    for a, b in segs:
        cur = a
        for s0, s1 in sil:
            al = alvo(s0, s1)
            s0, s1 = max(s0, cur), min(s1, b)
            if s1 - s0 >= max(p['maxima'], al + 0.05):
                h = al / 2
                out.append([cur, s0 + h]); cur = s1 - h
        out.append([cur, b])
    return [s for s in out if s[1] - s[0] > 0.02]


SEGS = keep_segments()


def to_video(t):
    acc = 0.0
    for a, b in SEGS:
        if t < a: return acc
        if t <= b: return acc + t - a
        acc += b - a
    return acc


TOTAL_AUDIO = sum(b - a for a, b in SEGS)


def audio():
    src = os.path.join(ROOT, E['audio'])
    parts, fl = [], []
    for i, (a, b) in enumerate(SEGS):
        d = b - a
        fl.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0, d - 0.012):.3f}:d=0.012[s{i}]")
        parts.append(f"[s{i}]")
    fl.append(''.join(parts) + f"concat=n={len(SEGS)}:v=0:a=1[c]")
    fl.append("[c]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[o]")
    wav = os.path.join(B, 'narracao-limpa.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-filter_complex', ';'.join(fl), '-map', '[o]', '-ac', '1', wav], check=True)
    return wav


def timeline():
    ant, scenes = E['antecipar'], []
    cs = E['cenas']
    starts = [0.0] + [max(0.0, to_video(c['inicio']) - ant) for c in cs[1:]]
    total = round(round((TOTAL_AUDIO + E['final']) * FPS) / FPS, 3)
    for k, c in enumerate(cs):
        st = round(starts[k] * FPS) / FPS
        en = round(starts[k + 1] * FPS) / FPS if k + 1 < len(cs) else total
        warp = [[round(to_video(a) - st, 3), s] for a, s in c.get('sync', [])]
        scenes.append({'scene': c['cena'], 'start': st, 'dur': round(en - st, 4), 'warp': warp})
    return {'fps': FPS, 'total': total, 'scenes': scenes}


def palavras(TL):
    W = json.load(open(os.path.join(B, 'palavras.json'), encoding='utf-8'))
    for sc in TL['scenes']:
        out = []
        for w in W:
            inside = any(a <= w['s'] < b for a, b in SEGS)
            v = to_video(w['s']) - sc['start']
            if inside and 0 <= v < sc['dur']: out.append(f"{w['w']}@{v:.1f}")
        print(f"\n== cena {sc['scene']} · início {sc['start']:.2f} · {sc['dur']:.1f} s\n" + ' '.join(out))


def mix(proj, T):
    som = os.path.join(B, 'som-maquina.wav')
    if not os.path.exists(som): return False
    narr = os.path.join(B, 'narracao-limpa.wav')
    g = E['volume_maquina_db']
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', som, '-i', narr, '-filter_complex',
                    f"[0:a]volume={g}dB[m];[1:a]apad[n];[m][n]sidechaincompress=threshold=0.05:ratio=3:attack=30:release=500[d];[d]alimiter=limit=0.6:level=false,aresample=48000[o]",
                    '-map', '[o]', '-t', f"{T:.3f}", '-c:a', 'aac', '-b:a', '192k', os.path.join(proj, 'som-maquina.m4a')], check=True)
    return True


def project(TL, fmt):
    proj = os.path.join(V, 'project' if fmt == '169' else 'project-916')
    os.makedirs(proj, exist_ok=True)
    for old in glob.glob(os.path.join(proj, 'app-*')): shutil.rmtree(old)
    app = f"app-{int(time.time())}"
    shutil.copytree(os.path.join(ROOT, 'js'), os.path.join(proj, app, 'js'))
    shutil.copytree(os.path.join(ROOT, 'css'), os.path.join(proj, app, 'css'))
    shutil.copy(os.path.join(V, 'src', 'driver.js'), os.path.join(proj, 'driver.js'))
    with open(os.path.join(proj, 'timeline.js'), 'w', encoding='utf-8') as f:
        f.write('// gerado por video/tools/build.py: não edite\nexport const TIMELINE = ' + json.dumps(TL) + ';\n')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(B, 'narracao-limpa.wav'), '-c:a', 'aac', '-b:a', '192k',
                    os.path.join(proj, 'narracao.m4a')], check=True)
    has_som = mix(proj, TL['total'])
    W, H = (1920, 1080) if fmt == '169' else (1080, 1920)
    T = TL['total']
    body = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    stage = body[body.index('<div id="stage"'):body.index('<script')]
    stage = stage.replace('<div id="stage" class="f169">',
                          f'<div id="stage" class="f{fmt}" data-composition-id="sim" data-start="0" data-duration="{T}" data-track-index="0" data-no-timeline>')
    stage = stage.rstrip()
    if stage.endswith('</div>'): stage = stage[:-6]  # fecha #viewport abaixo
    som_tag = f'\n  <audio id="maquina" src="som-maquina.m4a" data-start="0" data-duration="{T}" data-track-index="3" data-volume="1"></audio>' if has_som else ''
    html = f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width={W}, height={H}">
<title>Motores de moto · vídeo</title>
<link rel="stylesheet" href="{app}/css/style.css">
<style>html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#0b1118}}</style>
<script>window.__VIDEO_MODE = true; window.__VIDEO_FMT = '{fmt}';</script>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{T}" data-width="{W}" data-height="{H}" data-fps="{FPS}" data-no-timeline>
<div id="viewport">
  {stage.strip()}
</div>
  <audio id="narracao" src="narracao.m4a" data-start="0" data-duration="{round(TOTAL_AUDIO, 3)}" data-track-index="2" data-volume="1"></audio>{som_tag}
</div>
<script type="module" src="{app}/js/main.js"></script>
<script type="module" src="driver.js?v={app}"></script>
</body>
</html>
'''
    open(os.path.join(proj, 'index.html'), 'w', encoding='utf-8').write(html)
    return proj, has_som


if __name__ == '__main__':
    TL = timeline()
    if '--palavras' in sys.argv:
        palavras(TL); sys.exit()
    audio()
    if '--audio' in sys.argv:
        print(f'narracao-limpa.wav: {TOTAL_AUDIO:.1f} s'); sys.exit()
    for fmt in ['169'] + (['916'] if '--916' in sys.argv else []):
        p, s = project(TL, fmt)
        print(f"{p}: {TL['total']:.1f} s, {len(TL['scenes'])} cenas, som da máquina: {'sim' if s else 'não'}")
