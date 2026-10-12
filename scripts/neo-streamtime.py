"""Timing di arrivo righe JSON nel pipe (come fa Rust)."""
import json, subprocess, time, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OC = os.path.expandvars(r"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe")
t0 = time.perf_counter()
p = subprocess.Popen(
    [OC, "run", "--format", "json", "--thinking", "--variant", "minimal",
     "--dir", ROOT, "--auto",
     "crea site-lab/tt1.txt con dentro TT1 e site-lab/tt2.txt con dentro TT2, poi conferma con FATTO"],
    cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    text=True, encoding="utf-8", errors="replace", bufsize=1)
n = 0
for line in p.stdout:
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        e = json.loads(line)
    except ValueError:
        continue
    n += 1
    print(f"+{time.perf_counter()-t0:5.1f}s {e.get('type')}", flush=True)
p.wait()
print(f"FINE {time.perf_counter()-t0:.1f}s, {n} eventi", flush=True)
