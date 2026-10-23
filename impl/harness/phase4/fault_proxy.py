#!/usr/bin/env python3
"""Fault-injecting JSON-RPC reverse proxy for TC13 (Phase 4, P0.1), bound to 127.0.0.1 only.

usage: fault_proxy.py <listen_port> <upstream_url> <jsonl_log> [--delay SECONDS] [--rewrite-file JSON]
                      [--signal-dir DIR] [--heads]

It extends the Level 0 recorder (results/level0/raw/vps/level0/scripts/rpc_recorder.py): every POST body is forwarded
to <upstream_url> and recorded, with the request path. The TC13 harness gives each request's connector the URL
`<proxy>/<label>`, with labels of the form

    tc13.<run>.<path>.<subject>.<view>.<fault>      (P0.1; P0.2 uses the same form with the prefix p02)

For a label of that form, the proxy injects <fault> into every `eth_call` whose 4-byte selector is <view>'s (the other
calls of the request pass through unchanged):

    control         no fault (baseline)
    jsonrpc-error   a JSON-RPC error object (-32000)
    http-503        HTTP 503 with a text body
    drop            the connection is closed without any response
    delay           the answer is held for --delay seconds, then forwarded (longer than the worker's call timeout)
    malformed-json  HTTP 200 with a truncated JSON body
    empty-0x        "result": "0x"
    short           a 31-byte result
    revert-data     a revert carrying Error("injected fault") data (code 3)
    revert-nodata   a revert without any data field (code 3)
    intermittent    the first matching call gets a JSON-RPC error, every later one passes through
    hold            (Phase 4, P0.2) the call is forwarded at once and its true answer held for --delay seconds;
                    with --signal-dir, the file <DIR>/<label>.hold is rewritten each time a hold starts (it holds
                    the number of held calls of that label so far, the latest upstream answer time and, with --heads,
                    the head block the node had then); if <DIR>/<label>.abort
                    appears during the hold, the connection is closed without an answer (a stopped worker's call)

Code rewriting (Phase 4, P0.4, the EIP-7851 simulation): with --rewrite-file, every `eth_getCode` whose address is a
key of that JSON object ({"0x<address>": "0x<code>"}, re-read on every call) is answered with that code instead of
the node's, at whatever block was asked. Execution is untouched: anvil keeps the real `0xef0100` delegation, so
calls into the account still run its delegate. Such records carry "rewrite": true.

With --heads, every forwarded eth_call record also carries "head": the node's block number read right after its
answer (anvil mines only on transactions, so this is the block "latest" referred to unless one landed meanwhile).

Each record holds: "t0" (request received), "t" (answer sent or connection dropped), "path", "req", "resp" (what was
sent back, or null), "fault" (the fault applied to this call, or null) and "upstream" (whether anvil was asked).
"""
import json
import os
import socket
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VIEWS = {
    "isAllowed": "0x82027b6d",
    "isHandleDelegatedForUserDecryption": "0xd09c0dee",
    "decryptionSignatureInvalidatedBefore": "0x0dff1525",
}
FAULTS = {
    "control", "jsonrpc-error", "http-503", "drop", "delay", "malformed-json", "empty-0x", "short",
    "revert-data", "revert-nodata", "intermittent", "hold",
}

PORT, UPSTREAM, LOG = int(sys.argv[1]), sys.argv[2], sys.argv[3]
DELAY = 12.0
if "--delay" in sys.argv:
    DELAY = float(sys.argv[sys.argv.index("--delay") + 1])
REWRITE_FILE = sys.argv[sys.argv.index("--rewrite-file") + 1] if "--rewrite-file" in sys.argv else None
SIGNAL_DIR = sys.argv[sys.argv.index("--signal-dir") + 1] if "--signal-dir" in sys.argv else None
HEADS = "--heads" in sys.argv
LOCK = threading.Lock()
SEEN = {}  # label -> number of matching calls seen (for "intermittent")
HOLDS = {}  # label -> number of held calls (for "hold")

# Error("injected fault"), ABI-encoded.
_MSG = b"injected fault"
REVERT_DATA = "0x08c379a0" + (
    (32).to_bytes(32, "big") + len(_MSG).to_bytes(32, "big") + _MSG.ljust(32, b"\0")
).hex()


def parse_label(path):
    parts = path.strip("/").split(".")
    if len(parts) != 6 or parts[0] not in ("tc13", "p02"):
        return None
    _, run, req_path, subject, view, fault = parts
    if view not in VIEWS or fault not in FAULTS:
        return None
    return {"run": run, "path": req_path, "subject": subject, "view": view, "fault": fault}


def selector(body):
    if body.get("method") != "eth_call":
        return None
    call = (body.get("params") or [{}])[0] or {}
    data = call.get("input") or call.get("data") or ""
    return data[:10].lower()


def rewritten_code(body):
    """The configured code for an eth_getCode request, or None."""
    if REWRITE_FILE is None or body.get("method") != "eth_getCode":
        return None
    try:
        with open(REWRITE_FILE, encoding="utf-8") as f:
            table = {k.lower(): v for k, v in json.load(f).items()}
    except (OSError, ValueError):
        return None
    address = str((body.get("params") or [""])[0]).lower()
    return table.get(address)


def upstream(raw):
    req = urllib.request.Request(UPSTREAM, data=raw, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def head():
    """The node's current block number (the proxy's own call; not recorded as a worker request)."""
    raw = json.dumps({"jsonrpc": "2.0", "id": 0, "method": "eth_blockNumber", "params": []}).encode()
    try:
        return int(json.loads(upstream(raw))["result"], 16)
    except Exception:  # noqa: BLE001 - a missing head is recorded as null
        return None


def write_log(rec):
    with LOCK, open(LOG, "a") as f:
        f.write(json.dumps(rec, separators=(",", ":")) + "\n")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _reply(self, status, payload, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        t0 = time.time()
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        body = json.loads(raw)
        rid = body.get("id")
        spec = parse_label(self.path)
        fault = None
        if spec and spec["fault"] != "control" and selector(body) == VIEWS[spec["view"]]:
            fault = spec["fault"]
            if fault == "intermittent":
                with LOCK:
                    n = SEEN.get(self.path, 0)
                    SEEN[self.path] = n + 1
                fault = "intermittent-fail" if n == 0 else None
        rec = {"t0": round(t0, 6), "path": self.path, "req": body, "fault": fault, "upstream": False, "resp": None}
        try:
            if fault == "drop":
                # Close without writing a byte: the client sees the connection end before any response.
                self.close_connection = True
                try:
                    self.connection.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                return
            if fault == "http-503":
                self._reply(503, b"injected fault: service unavailable", "text/plain")
                rec["resp"] = "HTTP 503"
                return
            if fault == "malformed-json":
                payload = ('{"jsonrpc":"2.0","id":%s,"result":"0x' % json.dumps(rid)).encode()
                self._reply(200, payload)
                rec["resp"] = payload.decode()
                return
            if fault in ("jsonrpc-error", "intermittent-fail"):
                resp = {"jsonrpc": "2.0", "id": rid, "error": {"code": -32000, "message": "injected fault"}}
            elif fault == "empty-0x":
                resp = {"jsonrpc": "2.0", "id": rid, "result": "0x"}
            elif fault == "short":
                resp = {"jsonrpc": "2.0", "id": rid, "result": "0x" + "00" * 30 + "01"}
            elif fault == "revert-data":
                resp = {"jsonrpc": "2.0", "id": rid,
                        "error": {"code": 3, "message": "execution reverted: injected fault", "data": REVERT_DATA}}
            elif fault == "revert-nodata":
                resp = {"jsonrpc": "2.0", "id": rid, "error": {"code": 3, "message": "execution reverted"}}
            elif rewritten_code(body) is not None:
                resp = {"jsonrpc": "2.0", "id": rid, "result": rewritten_code(body)}
                rec["rewrite"] = True
            else:
                if fault == "delay":
                    time.sleep(DELAY)
                resp_raw = upstream(raw)
                rec["upstream"] = True
                rec["t_upstream"] = round(time.time(), 6)
                resp = json.loads(resp_raw)
                if HEADS and body.get("method") == "eth_call":
                    rec["head"] = head()
                if fault == "hold":
                    label = self.path.strip("/")
                    if SIGNAL_DIR:
                        with LOCK:
                            HOLDS[label] = HOLDS.get(label, 0) + 1
                            tmp = f"{SIGNAL_DIR}/{label}.hold.tmp"
                            with open(tmp, "w") as f:
                                json.dump({"n": HOLDS[label], "t_upstream": rec["t_upstream"], "head": rec.get("head")}, f)
                            os.replace(tmp, f"{SIGNAL_DIR}/{label}.hold")
                    abort_path = f"{SIGNAL_DIR}/{label}.abort" if SIGNAL_DIR else None
                    deadline = time.time() + DELAY
                    while time.time() < deadline:
                        if abort_path and os.path.exists(abort_path):
                            rec["aborted"] = True
                            self.close_connection = True
                            try:
                                self.connection.shutdown(socket.SHUT_RDWR)
                            except OSError:
                                pass
                            return
                        time.sleep(0.05)
            payload = json.dumps(resp, separators=(",", ":")).encode()
            self._reply(200, payload)
            rec["resp"] = resp
        except (BrokenPipeError, ConnectionResetError) as e:
            rec["client_gone"] = type(e).__name__
        finally:
            rec["t"] = round(time.time(), 6)
            write_log(rec)


ThreadingHTTPServer.daemon_threads = True
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
