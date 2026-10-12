"""Stampa parti text + tool di un file dato."""
import json, pathlib, sys
p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "site-lab/_att.txt")
for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
    line = line.strip()
    if line.startswith("{"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        part = e.get("part") if isinstance(e.get("part"), dict) else {}
        if e.get("type") == "text" and part.get("text"):
            print("TEXT:", part["text"][:300])
        elif e.get("type") == "tool_use":
            print("TOOL:", part.get("tool"))
    else:
        print("LOG:", line[:200])
