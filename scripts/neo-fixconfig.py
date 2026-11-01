"""Ripara opencode.jsonc: rimuove model/small_model, pulisce virgole, reinserisce."""
import json, pathlib, re, sys

p = pathlib.Path.home() / ".config" / "opencode" / "opencode.jsonc"
text = p.read_text(encoding="utf-8")

def tidy(s: str) -> str:
    while True:
        b = s
        for a, c in [(",\r\n,", ","), (",\n,", ","), (", ,", ","),
                     (",\r\n}", "\r\n}"), (",\n}", "\n}"), (",}", "}"),
                     ("{\r\n,", "{\r\n"), ("{\n,", "{\n")]:
            s = s.replace(a, c)
        if s == b:
            return s

lines = [l for l in text.splitlines()
         if not l.strip().startswith('"model"') and not l.strip().startswith('"small_model"')]
text = tidy("\n".join(lines))

model = "opencode/deepseek-v4.1-flash-free"
small = "opencode/nemotron-3.5-lightning-free"
idx = text.rfind("}")
head = text[:idx].rstrip()
comma = "" if head.endswith("{") else ","
inject = f'{comma}\n  "model": "{model}",\n  "small_model": "{small}"\n'
text = tidy(text[:idx] + inject + text[idx:])

# verifica: togli commenti riga e prova a fare il parse
raw = re.sub(r"(?m)^\s*//.*$", "", text)
try:
    json.loads(raw)
    ok = True
except ValueError as e:
    ok = False
    print("ERRORE JSON:", e)

p.write_text(text, encoding="utf-8")
print("CONFIG-RIPARATO" if ok else "CONFIG-SCRITTO-MA-NON-VALIDO")
print(text)
