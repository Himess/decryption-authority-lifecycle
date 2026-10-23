"""Prints, for each package installed in a venv, the PyPI file that matches its installed wheel tag: name, version,
filename, URL and sha256 (PyPI JSON API, read-only). Packages installed from a local path are reported as such.

Usage: python -I wheel_provenance.py <venv dir>
"""
import glob
import json
import os
import sys
import urllib.request

site = glob.glob(os.path.join(sys.argv[1], "lib", "python3*", "site-packages"))[0]
for di in sorted(glob.glob(os.path.join(site, "*.dist-info"))):
    head = open(os.path.join(di, "METADATA"), encoding="utf-8").read().split("\n\n")[0]
    meta = dict(line.split(": ", 1) for line in head.splitlines() if ": " in line)
    name, ver = meta["Name"], meta["Version"]
    tags = [line.split(": ", 1)[1] for line in open(os.path.join(di, "WHEEL")).read().splitlines() if line.startswith("Tag: ")]
    direct = os.path.join(di, "direct_url.json")
    if os.path.exists(direct):
        print(f"{name} {ver} local {json.load(open(direct))['url']}")
        continue
    d = json.load(urllib.request.urlopen(f"https://pypi.org/pypi/{name}/{ver}/json", timeout=30))
    wheels = [u for u in d["urls"] if u["filename"].endswith(".whl")]
    # A file matches when its python, abi and platform tags include those of one installed tag.
    hit = []
    for u in wheels:
        parts = u["filename"][:-4].split("-")
        py, abi, plat = parts[-3], parts[-2], parts[-1]
        for t in tags:
            tp, ta, tplat = t.split("-")
            if tp in py.split(".") and ta in abi.split(".") and tplat in plat.split("."):
                hit.append(u)
                break
    if hit:
        u = hit[0]
        print(f"{name} {ver} {u['filename']} {u['url']} sha256={u['digests']['sha256']}")
    else:
        print(f"{name} {ver} NO-MATCH tags={tags}")
