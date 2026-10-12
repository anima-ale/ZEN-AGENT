# ZEN-AGENT - scarica i binari vendor in src-tauri/vendor/ (NON committati).
# Va lanciato PRIMA di tauri build (build-exe.bat lo fa da solo).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/fetch-vendor.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$vendor = Join-Path $root "src-tauri\vendor"
if (-not (Test-Path $vendor)) { New-Item -ItemType Directory -Force $vendor | Out-Null }

$oc = "C:\Users\giova\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe"
if (-not (Test-Path $oc)) { Write-Output "[ERRORE] opencode.exe non trovato."; exit 1 }
Copy-Item $oc (Join-Path $vendor "opencode.exe") -Force
Write-Output ("vendor: opencode.exe ({0} MB)" -f [math]::Round((Get-Item (Join-Path $vendor "opencode.exe")).Length / 1MB, 1))

$vc = Get-ChildItem -Path "C:\Program Files (x86)\Microsoft Visual Studio\*\BuildTools\VC\Redist\MSVC\*\vc_redist.x64.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vc) { Write-Output "[ERRORE] vc_redist.x64.exe non trovato."; exit 1 }
Copy-Item $vc.FullName (Join-Path $vendor "vc_redist.x64.exe") -Force
Write-Output ("vendor: vc_redist.x64.exe ({0} MB)" -f [math]::Round((Get-Item (Join-Path $vendor "vc_redist.x64.exe")).Length / 1MB, 1))
Write-Output "VENDOR-OK"
