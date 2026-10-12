@echo off
set PATH=C:\Users\giova\.cargo\bin;%PATH%
set CARGO_HOME=C:\Users\giova\.cargo
set RUSTUP_HOME=C:\Users\giova\.rustup
call npm run tauri build > "site-lab/_build047.txt" 2>&1
exit /b 0
