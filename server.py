#!/usr/bin/env python3
"""Static server dengan header no-store supaya preview selalu menampilkan file terbaru."""
import http.server

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('0.0.0.0', 8000), Handler)
    print('Serving on 0.0.0.0:8000 (no-store)')
    server.serve_forever()
