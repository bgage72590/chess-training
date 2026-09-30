"""Receives the diagnostics report the native smoke build posts (src/native/diagnostics.ts).

The app runs on the CI runner (the Mac app, or the iOS Simulator, which shares the host's network),
so it can reach this listener on 127.0.0.1. Each report is printed and appended to a file, one JSON
object per line, with the time it arrived.

  python3 native/ci/report-listener.py 8765 reports.ndjson
"""
import http.server, json, sys, time

PORT, OUT = int(sys.argv[1]), sys.argv[2]


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('content-length', 0))).decode('utf-8', 'replace')
        try:
            report = json.loads(body)
        except ValueError:
            report = {'unparsed': body[:2000]}
        line = json.dumps({'at': time.strftime('%H:%M:%S'), 'report': report})
        with open(OUT, 'a') as f:
            f.write(line + '\n')
        print(json.dumps(report, indent=1), flush=True)
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
