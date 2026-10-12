@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --format json --variant minimal --dir "%CD%" --auto "REGOLA FISSA: non scrivere mai nessun testo prima di aver finito con gli strumenti; lavora in silenzio e parla solo a lavoro concluso con conferme brevissime. Vietato annunciare. COMPITO: crea il file site-lab/bn2.txt con dentro BN2 e conferma con FATTO" > "site-lab/_narr.txt" 2>&1
exit /b 0
