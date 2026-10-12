"""Bench simultaneo: segmenti in parallelo vs frase intera singola."""
import json, re, subprocess, time, os
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OC = os.path.expandvars(r"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe")
RULE = ("REGOLA FISSA: lavora in silenzio, non annunciare mai nulla prima o "
        "durante gli strumenti. Se agisci: risposta finale di una sola riga "
        "in italiano col solo esito (es. Fatto.). Se rispondi a una domanda: "
        "risposta diretta e breve, in italiano. Mai come ci sei arrivato, "
        "mai errori o tentativi incontrati.")
CONN = re.compile(r"(\s+e\s+poi\s+|\s+poi\s+|\s+e\s+|\s+dopo\s+|\s+quindi\s+|\s+allora\s+|,\s*)",
                  re.I)

def clean_seg(s: str) -> str:
    s = re.sub(r"^\s*zen\b", "", s, flags=re.I)
    s = re.sub(r"^\s*(e\s+poi|poi|e|dopo|quindi|allora)\b\s*", "", s, flags=re.I)
    return re.sub(r"\s+", " ", s).strip()

def segments(full: str):
    return [s for s in (clean_seg(t) for t in CONN.split(full)[0::2]) if len(s) >= 2]

def run_oc(prompt: str, timeout=240):
    t0 = time.perf_counter()
    try:
        r = subprocess.run(
            [OC, "run", "--format", "json", "--thinking", "--variant", "minimal",
             "--dir", ROOT, "--auto", f"{RULE} COMPITO: {prompt}"],
            cwd=ROOT, capture_output=True, text=True, timeout=timeout,
            encoding="utf-8", errors="replace")
        raw = r.stdout or ""
    except Exception:
        raw = ""
    texts, tools = [], []
    for line in raw.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        part = e.get("part") if isinstance(e.get("part"), dict) else {}
        if e.get("type") == "text" and part.get("text"):
            texts.append(part["text"])
        elif e.get("type") == "tool_use":
            st = part.get("state") if isinstance(part.get("state"), dict) else {}
            if st.get("status") == "completed":
                tools.append(part.get("tool", "?"))
    return time.perf_counter() - t0, "".join(texts).strip(), tools

SENTS = [
    ("A-2azioni", "crea site-lab/q1.txt con dentro Q1 e poi crea site-lab/q2.txt con dentro Q2"),
    ("B-3azioni", "crea site-lab/r1.txt con dentro R1, crea site-lab/r2.txt con dentro R2 e dimmi quanti file q1.txt e q2.txt vedi in site-lab"),
    ("C-2letture", "leggi CHANGELOG.md e dimmi la prima versione in alto e poi conta i file tsx in src"),
]

out = []
for label, sent in SENTS:
    segs = segments(sent)
    print(f"{label}: {len(segs)} segmenti {segs}", flush=True)
    # parallelo con contesto come TITAN
    t0 = time.perf_counter()
    prompts, prev = [], None
    for s in segs:
        prompts.append(f"Contesto: {prev}. Istruzione: {s}" if prev else s)
        prev = s
    first, results = None, []
    with ThreadPoolExecutor(max_workers=len(prompts)) as ex:
        futs = [ex.submit(run_oc, p) for p in prompts]
        for f in futs:
            dt, ans, tools = f.result()
            if first is None:
                first = time.perf_counter() - t0
            results.append((round(dt, 1), ans[:120], tools))
    tall = time.perf_counter() - t0
    # singolo con frase intera
    ts, anss, toolss = run_oc(sent)
    print(f"  parallelo: prima={first:.1f}s tutte={tall:.1f}s | singolo: {ts:.1f}s",
          flush=True)
    out.append({"label": label, "segs": segs, "t_first": round(first, 1),
                "t_all": round(tall, 1), "t_single": round(ts, 1),
                "answers_par": results, "answer_single": anss[:200]})

with open(os.path.join(ROOT, "site-lab", "_benchpar.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
tp = [o["t_all"] for o in out]; ts = [o["t_single"] for o in out]
print(f"BENCHPAR-FINITO paral-max={max(tp):.1f} singolo-max={max(ts):.1f}", flush=True)
