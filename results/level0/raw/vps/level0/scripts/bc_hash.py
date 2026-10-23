import hashlib, json, sys
for p in sys.argv[1:]:
    j = json.load(open(p, encoding="utf-8"))
    out = []
    for k in ("bytecode", "deployedBytecode"):
        o = j[k]["object"]
        o = o[2:] if o.startswith("0x") else o
        b = bytes.fromhex(o)
        out.append("%s len=%d sha256=%s" % (k, len(b), hashlib.sha256(b).hexdigest()[:24]))
    print(p.split("/")[-1] if "/" in p else p, "|", " | ".join(out))
