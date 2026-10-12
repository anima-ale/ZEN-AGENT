"""Stampa parti text + tool di _narr.txt."""
import json, pathlib
p = pathlib.Path("site-lab/_narr.txt")
for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        e = json.loads(line)
    except ValueError:
        continue
    part = e.get("part") if isinstance(e.get("part"), dict) else {}
    if e.get("type") == "text" and part.get("text"):
        print("TEXT:", part["text"])
    elif e.get("type") == "tool_use":
        print("TOOL:", part.get("tool"))
