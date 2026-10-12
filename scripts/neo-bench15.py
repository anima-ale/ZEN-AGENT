"""Bench 0.4.9 · 15 prompt facile->difficile. Replica la logica dell'app:
cache disco (stessa cartella dell'app) + diretto+minimal per primo."""
import json, subprocess, time, pathlib, os

ROOT = pathlib.Path(__file__).resolve().parent.parent
OC = os.path.expandvars(r"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe")
CACHE = pathlib.Path.home() / ".zen-agent" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "site-lab"
TTL, CAP = 86400, 100

def fnv1a(s: str) -> int:
    h = 0xCBF29CE484222325
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x100000001B3) & 0xFFFFFFFFFFFFFFFF
    return h

def cache_get(p: str):
    f = CACHE / f"{fnv1a(p):016x}.json"
    try:
        v = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if time.time() - v.get("t", 0) > TTL:
        f.unlink(missing_ok=True)
        return None
    return v.get("r")

def cache_put(p: str, r: str):
    files = sorted(CACHE.glob("*.json"),
                   key=lambda x: x.stat().st_mtime if x.exists() else 0)
    if len(files) >= CAP and files:
        files[0].unlink(missing_ok=True)
    (CACHE / f"{fnv1a(p):016x}.json").write_text(
        json.dumps({"t": int(time.time()), "r": r}), encoding="utf-8")

def run_oc(args, timeout=300):
    return subprocess.run([OC] + args, cwd=str(ROOT), capture_output=True,
                          text=True, timeout=timeout, encoding="utf-8",
                          errors="replace")

def attempt(prompt, attach: bool, fast: bool):
    a = ["run", "--format", "json", "--thinking"]
    if attach:
        a += ["--attach", "http://127.0.0.1:4096"]
    if fast:
        a += ["--variant", "minimal"]
    a += ["--dir", str(ROOT), "--auto", prompt]
    return run_oc(a)

def parse(raw: str):
    texts, tools, toks = [], [], None
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        part = e.get("part") if isinstance(e.get("part"), dict) else {}
        t = e.get("type")
        if t == "text" and part.get("text"):
            texts.append(part["text"])
        elif t == "tool_use":
            st = part.get("state") if isinstance(part.get("state"), dict) else {}
            if st.get("status") == "completed":
                tools.append(part.get("tool", "?"))
        elif t == "step_finish" and isinstance(part.get("tokens"), dict):
            toks = part["tokens"]
    return "".join(texts).strip(), tools, toks

PROMPTS = [
    ("01-banale", "rispondi solo con: CIAO"),
    ("02-calcolo", "quanto fa 17 per 23? Rispondi solo con il numero."),
    ("03-traduzione", "traduci in inglese: il gatto dorme sul tetto. Solo la traduzione."),
    ("04-data", "che giorno della settimana era il 12 ottobre 2026? Solo il giorno."),
    ("05-haiku", "scrivi un haiku sull'autunno, solo le tre righe."),
    ("06-spiegazione", "spiega la ricorsione in 2 righe a un bambino di 8 anni."),
    ("07-un-file", "crea il file site-lab/b1.txt con dentro B1 e conferma con FATTO"),
    ("08-tre-file", "crea in site-lab i file b2.txt con dentro B2 e b3.txt con dentro B3, poi elencali"),
    ("09-leggi-changelog", "leggi CHANGELOG.md e dimmi qual e' l'ultima versione in alto. Solo la versione."),
    ("10-conta-tsx", "quanti file .tsx ci sono nella cartella src, ricorsivo? Solo il numero."),
    ("11-todo-report", "cerca TODO e FIXME in src, scrivi site-lab/b-todo.txt con l'elenco e dimmi quante occorrenze hai trovato"),
    ("12-analisi-api", "leggi src/api.ts ed elenca le funzioni esportate in api, una per riga, senza spiegazioni"),
    ("13-primi", "crea site-lab/primi.py che stampa i primi 100 numeri primi, eseguilo e dammi solo l'ultimo numero stampato"),
    ("14-ragionamento", "meglio la cache su disco o il warm-up all'avvio per velocizzare un assistente AI? 3 righe, prendi posizione."),
    ("15-fib-verifica", "crea site-lab/fib.py con fibonacci memoization, eseguilo per n=30, verifica il risultato e dimmi valore e complessita'"),
]

print("warm-up...", flush=True)
try:
    attempt("rispondi OK", False, True)
except Exception as e:
    print("warm-up fallito:", e, flush=True)

summary = []
for label, prompt in PROMPTS:
    key = prompt.strip()
    t0 = time.perf_counter()
    source, answer, tools, toks = "run", "", [], None
    hit = cache_get(key) if len(prompt) <= 500 else None
    if hit is not None:
        source, answer = "cache", hit
    else:
        raw = ""
        for att, fast in [(False, True), (False, False), (True, True), (True, False)]:
            try:
                r = attempt(prompt, att, fast)
                raw = r.stdout or ""
            except Exception:
                continue
            answer, tools, toks = parse(raw)
            if answer or tools:
                break
        if len(prompt) <= 500 and (answer or tools):
            cache_put(key, answer)
    dt = time.perf_counter() - t0
    (OUT / f"_b15_{label}.txt").write_text(
        f"answer:\n{answer}\n\ntools: {tools}\ntokens: {toks}\nsource: {source}\n",
        encoding="utf-8")
    summary.append({"label": label, "secs": round(dt, 2), "source": source,
                    "tools": tools, "tokens": toks, "answer": answer[:400]})
    print(f"{label}: {dt:.1f}s [{source}] tools={tools} toks={toks}",
          flush=True)

# bis: ripetizione prompt 01 per effetto cache
t0 = time.perf_counter()
hit = cache_get(PROMPTS[0][1].strip())
dt = time.perf_counter() - t0
print(f"bis-01-cache: {dt:.3f}s hit={hit is not None}", flush=True)
summary.append({"label": "bis-01-cache", "secs": round(dt, 3),
                "source": "cache", "tools": [], "tokens": None,
                "answer": hit})

(OUT / "_b15_summary.json").write_text(
    json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
times = [s["secs"] for s in summary if s["label"] != "bis-01-cache"]
print(f"BENCH15-FINITO min={min(times):.1f} max={max(times):.1f} "
      f"media={sum(times)/len(times):.1f}", flush=True)
