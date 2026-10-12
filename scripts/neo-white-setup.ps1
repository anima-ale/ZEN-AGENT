# ZEN-AGENT - setup BIANCO di Tauri con nome stabile (niente versione).
# Copia il setup appena compilato in ZEN-AGENT_x64-setup.exe e pulisce i versionati.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/neo-white-setup.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$nsis = Join-Path $root "src-tauri\target\release\bundle\nsis"
$src = Get-ChildItem -Path $nsis -Filter "*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^ZEN-AGENT_.*_x64-setup\.exe$" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $src) { Write-Output "[ERRORE] nessun setup in bundle\nsis."; exit 1 }
$dst = Join-Path $nsis "ZEN-AGENT_x64-setup.exe"
Copy-Item $src.FullName $dst -Force
Get-ChildItem -Path $nsis -Filter "*.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "^ZEN-AGENT_[0-9].*_x64-setup\.exe$" } | Remove-Item -Force -ErrorAction SilentlyContinue
$sha = (Get-FileHash $dst -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output ("WHITE-SETUP-OK: ZEN-AGENT_x64-setup.exe ({0} MB) sha256={1}" -f [math]::Round((Get-Item $dst).Length / 1MB, 1), $sha)
