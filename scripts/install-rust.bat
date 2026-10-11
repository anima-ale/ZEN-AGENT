@echo off
REM ZEN-AGENT - installa Rust da solo (rustup, toolchain stable)
set INIT=%TEMP%\rustup-init.exe
echo [rust] download rustup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dl-rust.ps1"
if not exist "%INIT%" (
  echo [rust] ERRORE download rustup-init
  exit /b 1
)
echo [rust] installo toolchain stable...
"%INIT%" -y --default-toolchain stable --profile minimal
set CARGO=%USERPROFILE%\.cargo\bin
if exist "%CARGO%\cargo.exe" (
  echo [rust] OK:
  "%CARGO%\cargo.exe" --version
  "%CARGO%\rustc.exe" --version
) else (
  echo [rust] ERRORE installazione
  exit /b 1
)
