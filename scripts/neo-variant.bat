@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --format default --variant minimal --dir "%CD%" --auto "rispondi solo con: VVV" > "site-lab/_variant.txt" 2>&1
echo EXIT=%ERRORLEVEL% >> "site-lab/_variant.txt"
exit /b 0
