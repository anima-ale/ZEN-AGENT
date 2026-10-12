@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --format json --variant minimal --dir "%CD%" --auto "rispondi solo con: WWW" > "site-lab/_json1.txt" 2>&1
exit /b 0
