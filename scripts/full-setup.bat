@echo off
REM ZEN-AGENT - doppio click per setup completo (scarica TUTTO e crea il setup .exe)
powershell -ExecutionPolicy Bypass -File "%~dp0install-prereqs.ps1"
powershell -ExecutionPolicy Bypass -File "%~dp0bootstrap-opencode.ps1"
call npm install
call npx tauri build
echo.
echo Setup .exe in src-tauri\target\release\bundle\nsis\
pause
