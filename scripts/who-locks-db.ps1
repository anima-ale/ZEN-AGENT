$ErrorActionPreference = "Stop"
$out = "$env:TEMP\handle64.exe"
if (-not (Test-Path $out)) {
  Invoke-WebRequest -Uri "https://live.sysinternals.com/handle64.exe" -OutFile $out -UseBasicParsing
}
& $out -accepteula -nobanner "$env:USERPROFILE\.local\share\opencode\opencode.db"
