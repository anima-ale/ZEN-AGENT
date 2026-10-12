$oc = "$env:APPDATA\npm\node_modules\opencode-ai\bin\opencode.exe"
& $oc run --help > "site-lab/_runhelp.txt" 2>&1
exit 0
