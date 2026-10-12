$ErrorActionPreference = "Stop"
$src = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\site-lab\index.html"
$dstDir = "D:\HOBBY\ZEN vero funzionante\ZEN\avvio\ZEN 6.0 ULTRA\ZEN 6 public BETA"
$dst = Join-Path $dstDir "index-con-zen-agent.html"
Copy-Item $src $dst -Force
Write-Output ("SITO: {0}" -f $dst)
