$ErrorActionPreference = "Stop"
$root = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle"
Set-Location $root
Remove-Item -Recurse -Force "src-tauri\icons\ios" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "src-tauri\icons\android" -ErrorAction SilentlyContinue
Remove-Item -Force "src-tauri\icons\Square*.png", "src-tauri\icons\StoreLogo.png" -ErrorAction SilentlyContinue
Get-ChildItem "src-tauri\icons"
Write-Output "CLEAN-OK"
