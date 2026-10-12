$ErrorActionPreference = "Stop"
$root = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle"
Set-Location $root
$nsis = Join-Path $root "src-tauri\target\release\bundle\nsis"
Get-ChildItem -Path $nsis -Filter "*.exe" | Where-Object { $_.Name -match "^ZEN-AGENT_[0-9].*_x64-setup\.exe$" } | ForEach-Object {
  Write-Output ("RIMUOVO: {0}" -f $_.Name)
  Remove-Item $_.FullName -Force
}
Write-Output "--- RESTA: ---"
Get-ChildItem -Path $nsis -Filter "*.exe" | ForEach-Object { Write-Output $_.Name }
