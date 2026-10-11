param([string]$f)
$errs = $null
[void][System.Management.Automation.PSParser]::Tokenize((Get-Content $f -Raw), [ref]$errs)
if ($errs.Count -eq 0) { Write-Host "PARSE-OK: $f" } else { $errs | ForEach-Object { Write-Host $_.Message } }
