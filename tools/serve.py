# Servidor local sem cache (para testar mudanças nos módulos ES): python3 tools/serve.py [porta]
# Também recebe gravações de som feitas offline: POST /save?name=arquivo.wav → tools/out/arquivo.wav
import http.server, functools, os, sys, urllib.parse
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'tools', 'out')
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get('name', ['som.wav'])[0])
        n = int(self.headers.get('Content-Length', 0))
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, name), 'wb') as f: f.write(self.rfile.read(n))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8781
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
