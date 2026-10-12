@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo === BENCH ZEN-AGENT · variant minimal === > "site-lab/_bench.txt" 2>&1
echo --- P0 baseline facile SENZA variant --- >> "site-lab/_bench.txt"
echo START %TIME% >> "site-lab/_bench.txt"
"%OC%" run --format json --dir "%CD%" --auto "rispondi solo con: PONG" > "site-lab/_bench0.txt" 2>&1
echo END %TIME% >> "site-lab/_bench.txt"
echo --- P1 facile --- >> "site-lab/_bench.txt"
echo START %TIME% >> "site-lab/_bench.txt"
"%OC%" run --format json --variant minimal --dir "%CD%" --auto "rispondi solo con: PING" > "site-lab/_bench1.txt" 2>&1
echo END %TIME% >> "site-lab/_bench.txt"
echo --- P2 medio: 3 file + elenco --- >> "site-lab/_bench.txt"
echo START %TIME% >> "site-lab/_bench.txt"
"%OC%" run --format json --variant minimal --dir "%CD%" --auto "crea in site-lab i file bench-a.txt con dentro A, bench-b.txt con dentro B, bench-c.txt con dentro C, poi elencami i tre nomi" > "site-lab/_bench2.txt" 2>&1
echo END %TIME% >> "site-lab/_bench.txt"
echo --- P3 difficile: cerca TODO/FIXME in src e report --- >> "site-lab/_bench.txt"
echo START %TIME% >> "site-lab/_bench.txt"
"%OC%" run --format json --variant minimal --dir "%CD%" --auto "cerca in src tutti i TODO e FIXME, scrivi site-lab/bench-report.txt con l'elenco file meno riga, poi riepilogami quante occorrenze hai trovato e dove" > "site-lab/_bench3.txt" 2>&1
echo END %TIME% >> "site-lab/_bench.txt"
echo BENCH-FINITO >> "site-lab/_bench.txt"
exit /b 0
