$log = "C:\Users\giova\.local\share\opencode\log\opencode.log"
$lines = Get-Content $log -Tail 1500 -Encoding UTF8
$hits = $lines | Select-String -Pattern "Unexpected server error|Provider|stream error|AI_APICallError|finishReason|provider" -CaseSensitive:$false
$hits | Select-Object -Last 15 | ForEach-Object { $_.ToString().Substring(0, [Math]::Min(320, $_.ToString().Length)) }
