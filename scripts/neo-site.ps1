$ErrorActionPreference = "Stop"
$zip = "D:\HOBBY\ZEN vero funzionante\ZEN\avvio\ZEN 6.0 ULTRA\ZEN 6 public BETA\SITO web dello zen lab.zip"
$dest = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\site-lab"
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force $dest | Out-Null
Expand-Archive -Path $zip -DestinationPath $dest -Force
Get-ChildItem -Recurse $dest | ForEach-Object { Write-Output $_.FullName }
