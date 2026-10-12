@echo off
set OC=%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe
cd /d "%~dp0.."
echo --- spawn x3 --- > "site-lab/_prof.txt" 2>&1
echo S %TIME% >> "site-lab/_prof.txt"
"%OC%" --version > NUL 2>&1
echo E %TIME% >> "site-lab/_prof.txt"
echo S %TIME% >> "site-lab/_prof.txt"
"%OC%" --version > NUL 2>&1
echo E %TIME% >> "site-lab/_prof.txt"
echo S %TIME% >> "site-lab/_prof.txt"
"%OC%" --version > NUL 2>&1
echo E %TIME% >> "site-lab/_prof.txt"
echo --- easy DIRECT --- >> "site-lab/_prof.txt"
echo S %TIME% >> "site-lab/_prof.txt"
"%OC%" run --format json --variant minimal --dir "%CD%" --auto "rispondi solo con: Q" > "site-lab/_profd.txt" 2>&1
echo E %TIME% >> "site-lab/_prof.txt"
echo PROF-FINITO >> "site-lab/_prof.txt"
exit /b 0
