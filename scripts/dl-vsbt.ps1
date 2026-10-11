$ErrorActionPreference = "Stop"
$out = "$env:TEMP\vs_BuildTools.exe"
Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_BuildTools.exe" -OutFile $out -UseBasicParsing
Write-Host "[msvc] scaricato: $out"
