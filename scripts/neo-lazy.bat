@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo --- L1: con minimal --- > "site-lab/_lazy.txt" 2>&1
"%OC%" run --format json --thinking --variant minimal --dir "%CD%" --auto "REGOLA FISSA: lavora in silenzio, non annunciare mai nulla prima o durante gli strumenti. Se agisci: risposta finale di una sola riga in italiano col solo esito (es. Fatto.). Se rispondi a una domanda: risposta diretta e breve, in italiano. Mai come ci sei arrivato, mai errori o tentativi incontrati. COMPITO: crea il file site-lab/lazy1.txt con dentro L1" >> "site-lab/_lazy.txt" 2>&1
echo --- L2: senza variant --- >> "site-lab/_lazy.txt" 2>&1
"%OC%" run --format json --thinking --dir "%CD%" --auto "REGOLA FISSA: lavora in silenzio, non annunciare mai nulla prima o durante gli strumenti. Se agisci: risposta finale di una sola riga in italiano col solo esito (es. Fatto.). Se rispondi a una domanda: risposta diretta e breve, in italiano. Mai come ci sei arrivato, mai errori o tentativi incontrati. COMPITO: crea il file site-lab/lazy2.txt con dentro L2" >> "site-lab/_lazy.txt" 2>&1
exit /b 0
