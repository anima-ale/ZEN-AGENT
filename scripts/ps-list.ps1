$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'opencode|ZEN-AGENT' }
if (-not $procs) { Write-Host 'nessun processo opencode/ZEN-AGENT attivo'; exit 0 }
foreach ($p in $procs) {
  Write-Host ('PID={0} NAME={1}' -f $p.ProcessId, $p.Name)
  Write-Host ('  CMD={0}' -f $p.CommandLine)
}
