$ErrorActionPreference = "Stop"
$dir = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\site-lab"
$keep = @("index.html", "ZEN-AGENT_dossier-rubato.txt", "ZEN-AGENT_dossier-rubato.CHIARO.txt", "ZEN-AGENT_presentazione.mp4", "image.png")
Get-ChildItem -Path $dir -File | Where-Object { $keep -notcontains $_.Name } | ForEach-Object {
  Write-Output ("ELIMINO: {0} ({1} KB)" -f $_.Name, [math]::Round($_.Length / 1KB, 1))
  Remove-Item $_.FullName -Force
}
Write-Output "--- RESTA: ---"
Get-ChildItem -Path $dir -File | ForEach-Object { Write-Output $_.Name }
