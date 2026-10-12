@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --format json --thinking --variant minimal --dir "%CD%" --auto "crea il file site-lab/_jtest.txt con dentro la parola JTEST e poi dimmi quante righe ha" > "site-lab/_json2.txt" 2>&1
exit /b 0
