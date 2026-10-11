$ErrorActionPreference = "Stop"
$out = "$env:TEMP\rustup-init.exe"
Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $out -UseBasicParsing
Write-Host "[rust] scaricato: $out"
