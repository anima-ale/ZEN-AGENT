@echo off
call npx tsc --noEmit > "site-lab/_tsc.txt" 2>&1
exit /b 0
