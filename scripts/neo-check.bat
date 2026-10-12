@echo off
set PATH=C:\Users\giova\.cargo\bin;%PATH%
set CARGO_HOME=C:\Users\giova\.cargo
set RUSTUP_HOME=C:\Users\giova\.rustup
cargo check --manifest-path src-tauri/Cargo.toml > "site-lab/_check.txt" 2>&1
exit /b 0
