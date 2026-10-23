#!/usr/bin/env python3
"""Minimal JSON-RPC recording reverse proxy, bound to 127.0.0.1 only (test harness).

usage: rpc_recorder.py <listen_port> <upstream_url> <jsonl_log>
Every POST body is forwarded unchanged to <upstream_url>; request and response are appended to <jsonl_log>.
"""
import json, sys, threading, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT, UPSTREAM, LOG = int(sys.argv[1]), sys.argv[2], sys.argv[3]
LOCK = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        req = urllib.request.Request(UPSTREAM, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = r.read()
        rec = {"t": round(time.time(), 3), "req": json.loads(body), "resp": json.loads(resp)}
        with LOCK, open(LOG, "a") as f:
            f.write(json.dumps(rec, separators=(",", ":")) + "\n")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)


ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
