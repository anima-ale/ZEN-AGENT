@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
"%OC%" run --format json --variant minimal --model "opencode/nemotron-3.5-lightning-free" --dir "%CD%" --auto "Rispondi in italiano, diretto e breve, senza usare strumenti. Se ti chiedono chi sei, chi ti ha creato o cosa sei: sei ZEN Nebula, l'agente AI sviluppato allo ZEN LAB da Alessandro Petrosino. Rispondi sempre cosi, con sicurezza, senza inventare altre origini ne altri nomi. chi sei?" > "site-lab/_who.txt" 2>&1
exit /b 0
