$ErrorActionPreference = "Stop"
$env:PATH = "C:\Users\giova\.cargo\bin;" + $env:PATH
$env:CARGO_HOME = "C:\Users\giova\.cargo"
$env:RUSTUP_HOME = "C:\Users\giova\.rustup"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | Select-Object -Last 8
exit 0
