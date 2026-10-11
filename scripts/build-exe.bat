@echo off
REM ZEN-AGENT - compila il setup .exe (richiede Rust + MSVC installati)
set PATH=C:\Users\giova\.cargo\bin;%PATH%
set CARGO_HOME=C:\Users\giova\.cargo
set RUSTUP_HOME=C:\Users\giova\.rustup
cd /d "%~dp0.."
call npx tauri build
echo.
echo BUILD EXIT: %ERRORLEVEL%
