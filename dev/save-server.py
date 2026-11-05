# Local helper for dev/make-sample.html: serves the project and saves the posted
# JPEG as docs/cember-ornek.jpg. Run from the project folder:
#   python dev/save-server.py
import http.server
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "docs", "cember-ornek.jpg")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        if self.path != "/save":
            self.send_error(404)
            return
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not data.startswith(b"\xff\xd8"):
            self.send_error(400)
            return
        with open(TARGET, "wb") as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
