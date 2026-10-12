$ErrorActionPreference = "Stop"
$root = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle"
Set-Location $root
$nsis = Join-Path $root "src-tauri\target\release\bundle\nsis"
$src = Get-ChildItem -Path $nsis -Filter "ZEN-AGENT_*_x64-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $src) { Write-Output "[ERRORE] nessun setup versionato."; exit 1 }
$dst = Join-Path $nsis "ZEN-AGENT_x64-setup.exe"
Copy-Item $src.FullName $dst -Force
Write-Output ("COPIATO: {0} -> {1}" -f $src.Name, "ZEN-AGENT_x64-setup.exe")
& gh release upload v0.4.3 $dst --clobber --repo anima-ale/ZEN-AGENT
if ($LASTEXITCODE -ne 0) { Write-Output "[ERRORE] upload fallito."; exit 1 }
Write-Output "UPLOAD-OK"
