"""Riepilogo bench: tempi esclusi, qui token + risposte."""
import json, pathlib

for n in (0, 1, 2, 3):
    p = pathlib.Path(f"site-lab/_bench{n}.txt")
    texts, tools, toks = [], [], None
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        t = e.get("type")
        part = e.get("part", {}) if isinstance(e.get("part"), dict) else {}
        if t == "text" and part.get("text"):
            texts.append(part["text"])
        elif t == "tool_use":
            st = part.get("state", {}) if isinstance(part.get("state"), dict) else {}
            if st.get("status") == "completed":
                tools.append(part.get("tool", "?"))
        elif t == "step_finish" and isinstance(part.get("tokens"), dict):
            toks = part["tokens"]
    print(f"--- P{n} ---")
    print("tools:", tools)
    print("tokens:", toks)
    ans = "".join(texts).strip()
    print("risposta:", ans[:600])
    print()
