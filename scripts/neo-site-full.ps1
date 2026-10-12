$ErrorActionPreference = "Stop"
$dir = "D:\HOBBY\ZEN vero funzionante\ZEN\avvio\ZEN 6.0 ULTRA\ZEN 6 public BETA\SITO web dello zen lab"
$src = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\site-lab\index.html"
$orig = Join-Path $dir "index.html"
$bak = Join-Path $dir "index-originale.html"
if (-not (Test-Path $bak)) {
  Copy-Item $orig $bak -Force
  Write-Output "BACKUP: index-originale.html"
}
Copy-Item $src $orig -Force
Write-Output "INDEX AGGIORNATO"
Get-ChildItem $dir -Filter "*.html" | ForEach-Object { Write-Output $_.Name }
