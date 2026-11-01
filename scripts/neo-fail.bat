@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo --- F1 model inesistente, poi reale --- > "site-lab/_fail.txt" 2>&1
"%OC%" run --format json --variant minimal --model "opencode/muse-spark-1.3-contributor-free" --dir "%CD%" --auto "rispondi solo con: NO" >> "site-lab/_fail.txt" 2>&1
echo EXIT1=%ERRORLEVEL% >> "site-lab/_fail.txt"
"%OC%" run --format json --variant minimal --model "opencode/longcat-2.5-preview-free" --dir "%CD%" --auto "rispondi solo con: SI" >> "site-lab/_fail.txt" 2>&1
echo EXIT2=%ERRORLEVEL% >> "site-lab/_fail.txt"
exit /b 0
