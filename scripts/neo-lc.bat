@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
"%OC%" run --format json --variant minimal --model "opencode/longcat-2.5-preview-free" --dir "%CD%" --auto "rispondi solo con: OKLC" > "site-lab/_lc.txt" 2>&1
exit /b 0
