@echo off
"%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe" run --help > "site-lab/_runhelp.txt" 2>&1
exit /b 0
