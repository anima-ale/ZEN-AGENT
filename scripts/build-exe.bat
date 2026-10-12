@echo off
REM ZEN-AGENT - compila il setup .exe (richiede Rust + MSVC installati)
set PATH=C:\Users\giova\.cargo\bin;%PATH%
set CARGO_HOME=C:\Users\giova\.cargo
set RUSTUP_HOME=C:\Users\giova\.rustup
cd /d "%~dp0.."
call powershell -NoProfile -ExecutionPolicy Bypass -File scripts\fetch-vendor.ps1
if errorlevel 1 goto fine
call npx tauri build
echo.
echo TAURI BUILD EXIT: %ERRORLEVEL%
if errorlevel 1 goto fine
REM Setup bianco Tauri con nome stabile (niente versione nel nome)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\neo-white-setup.ps1
echo.
echo WHITE SETUP EXIT: %ERRORLEVEL%
:fine
