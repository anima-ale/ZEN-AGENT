$ErrorActionPreference = "Stop"
$found = @()
$roots = @(
  "C:\Program Files\Microsoft Visual Studio",
  "C:\Program Files (x86)\Microsoft Visual Studio"
)
foreach ($r in $roots) {
  if (Test-Path $r) {
    $found += Get-ChildItem -Path $r -Recurse -Filter "vc_redist.x64.exe" -ErrorAction SilentlyContinue | Select-Object -First 3 FullName
  }
}
if ($found.Count -eq 0) { Write-Output "VCREDIST:NOTFOUND" }
else { $found | ForEach-Object { Write-Output ("VCREDIST:{0}" -f $_.FullName) } }
