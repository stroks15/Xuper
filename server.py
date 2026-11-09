#!/usr/bin/env python3
"""
Servidor estático + proxy de streams para XuperTV Vidaa.

Uso:
  python3 server.py
  → http://0.0.0.0:8765/

El proxy /proxy?url=... reenvía Content-Auth / Content-License
para que el <video> del navegador de la TV pueda reproducir.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8765"))

UA_CDN = "Ranger/4.9.4-17294ac0"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("[xuper] " + (fmt % args) + "\n")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy":
            return self._proxy(parsed)
        if parsed.path == "/api/resolve-info":
            # helper debug endpoint
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true,"proxy":"/proxy?url=..."}')
            return
        return super().do_GET()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Range, Content-Auth, Content-License, User-Agent, App, App-Version",
        )
        self.send_header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")

    def _proxy(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        target = (qs.get("url") or [""])[0]
        if not target or not target.startswith(("http://", "https://")):
            self.send_error(400, "url required")
            return

        # Headers from the TV page (preferred) or query string fallback
        auth = self.headers.get("Content-Auth") or (qs.get("auth") or [""])[0]
        license_h = self.headers.get("Content-License") or (qs.get("license") or [""])[0]
        range_h = self.headers.get("Range")

        req_headers = {
            "User-Agent": self.headers.get("User-Agent") or UA_CDN,
            "App": self.headers.get("App") or "com.android.msandroid",
            "App-Version": self.headers.get("App-Version") or "49902",
        }
        if auth:
            req_headers["Content-Auth"] = auth
        if license_h:
            req_headers["Content-License"] = license_h
        if range_h:
            req_headers["Range"] = range_h

        try:
            req = urllib.request.Request(target, headers=req_headers, method="GET")
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                self.send_response(resp.status)
                ctype = resp.headers.get("Content-Type", "video/mp2t")
                self.send_header("Content-Type", ctype)
                if resp.headers.get("Content-Range"):
                    self.send_header("Content-Range", resp.headers["Content-Range"])
                if resp.headers.get("Accept-Ranges"):
                    self.send_header("Accept-Ranges", resp.headers["Accept-Ranges"])
                self.send_header("Content-Length", str(len(data)))
                self._cors()
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "text/plain"))
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(msg)))
            self._cors()
            self.end_headers()
            self.wfile.write(msg)


def main():
    # Inject proxy helper into pages by serving a tiny extra script path is optional;
    # the index can detect location.origin and use /proxy.
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"XuperTV Vidaa → http://0.0.0.0:{PORT}/")
    print("Abre esa URL en el navegador de la TV (misma red).")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nAdiós")


if __name__ == "__main__":
    main()
