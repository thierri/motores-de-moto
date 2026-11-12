# Servidor do vídeo (porta 8770): serve a pasta do repositório sem cache e recebe o som da máquina.
# Uso: python3 -I video/tools/som.py   →  abrir http://localhost:8770/video/project/index.html?audio
import http.server, os, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUT = os.path.join(ROOT, 'video', 'build', 'som-maquina.wav')


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        open(OUT, 'wb').write(data)
        print(f'som-maquina.wav: {len(data) / 1e6:.1f} MB', flush=True)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')

    def log_message(self, *a): pass


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
print(f'http://localhost:{port}/', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
