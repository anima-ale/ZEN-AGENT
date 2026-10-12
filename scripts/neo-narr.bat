@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --format json --thinking --variant minimal --dir "%CD%" --auto "REGOLA FISSA: lavora in silenzio, non annunciare mai nulla prima o durante gli strumenti. Se agisci: risposta finale di una sola riga in italiano col solo esito (es. Fatto.). Se rispondi a una domanda: risposta diretta e breve, in italiano. Mai come ci sei arrivato, mai errori o tentativi incontrati. COMPITO: crea il file site-lab/clean1.txt con dentro C1" > "site-lab/_narr.txt" 2>&1
exit /b 0
