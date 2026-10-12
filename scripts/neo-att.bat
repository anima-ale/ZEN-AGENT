@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo --- T8: prompt prima di --file, immagine --- > "site-lab/_att.txt" 2>&1
"%OC%" run --format json --thinking --variant minimal --dir "%CD%" --auto "REGOLA FISSA: risposta finale di una sola riga in italiano col solo esito. COMPITO: descrivi in una riga cosa vedi" --file "%CD%\site-lab\image.png" >> "site-lab/_att.txt" 2>&1
echo EXIT=%ERRORLEVEL% >> "site-lab/_att.txt"
exit /b 0
