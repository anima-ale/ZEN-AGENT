@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo === quick chat test === > "site-lab/_quick.txt" 2>&1
echo S %TIME% >> "site-lab/_quick.txt"
"%OC%" run --format json --variant minimal --model "opencode/nemotron-3.5-lightning-free" --dir "%CD%" --auto "Rispondi in italiano, diretto e breve, senza usare strumenti. Quanto fa 12 per 12?" >> "site-lab/_quick.txt" 2>&1
echo E %TIME% >> "site-lab/_quick.txt"
exit /b 0
