@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content 'site-lab/_json2.txt' -Encoding UTF8 | Select-Object -Index 1,3" > "site-lab/_fields.txt" 2>&1
exit /b 0
