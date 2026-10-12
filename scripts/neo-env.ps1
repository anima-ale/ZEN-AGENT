$ErrorActionPreference = "Stop"
$mk = $null
try { $mk = (Get-Command makensis -ErrorAction SilentlyContinue).Source } catch {}
if (-not $mk) {
  $cand = Join-Path $env:LOCALAPPDATA "tauri\NSIS\makensis.exe"
  if (Test-Path $cand) { $mk = $cand }
}
Write-Output ("MAKENSIS:{0}" -f $mk)
$bstrap = Join-Path $env:LOCALAPPDATA "tauri\MicrosoftEdgeWebview2Setup.exe"
Write-Output ("BOOTSTRAPPER:{0} EXISTS:{1}" -f $bstrap, (Test-Path $bstrap))
$exe = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\src-tauri\target\release\ZEN-AGENT.exe"
Write-Output ("EXE EXISTS:{0}" -f (Test-Path $exe))
