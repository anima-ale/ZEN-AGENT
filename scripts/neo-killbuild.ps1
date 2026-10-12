$ErrorActionPreference = "SilentlyContinue"
foreach ($n in @("cargo", "rustc", "makensis", "candle", "light")) {
  $ps = Get-Process -Name $n -ErrorAction SilentlyContinue
  foreach ($p in $ps) {
    Write-Output ("KILLO: {0} id={1}" -f $n, $p.Id)
    Stop-Process -Id $p.Id -Force
  }
}
Write-Output "PULIZIA-FATTA"
