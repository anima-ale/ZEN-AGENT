$ErrorActionPreference = "Stop"
$root = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle"
Set-Location $root
& node "node_modules/@tauri-apps/cli/tauri.js" icon "C:\Users\giova\Pictures\logo zen-agent.png" --output "src-tauri/icons"
exit $LASTEXITCODE
