@echo off
REM ZEN-AGENT - compila il setup .exe (richiede Rust + MSVC installati)
set PATH=C:\Users\giova\.cargo\bin;%PATH%
set CARGO_HOME=C:\Users\giova\.cargo
set RUSTUP_HOME=C:\Users\giova\.rustup
cd /d "%~dp0.."
call npx tauri build
echo.
echo TAURI BUILD EXIT: %ERRORLEVEL%
if errorlevel 1 goto fine
REM Installer scuro NEO1 scritto a mano (sovrascrive il setup di Tauri)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-dark-setup.ps1
echo.
echo DARK SETUP EXIT: %ERRORLEVEL%
:fine
