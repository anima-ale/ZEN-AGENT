# ZEN-AGENT - compila l'installer NSIS scuro scritto a mano (nsis/zen-setup.nsi).
# Va lanciato DOPO tauri build (serve ZEN-AGENT.exe fresco + bootstrapper WebView2).
# L'output SOVRASCRIVE il setup di Tauri con lo stesso nome: la pipeline
# (make-zendate, pubblica-update, auto-update /S) resta invariata.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/build-dark-setup.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$ver = $pkg.version
$build = "$ver.0"

$exe = Join-Path $root "src-tauri\target\release\ZEN-AGENT.exe"
if (-not (Test-Path $exe)) {
  Write-Output ("[ERRORE] Manca {0}: lancia prima tauri build." -f $exe)
  exit 1
}
$side = Join-Path $root "src-tauri\nsis-assets\sidebar-dark.bmp"
if (-not (Test-Path $side)) {
  Write-Output "[ERRORE] Manca sidebar-dark.bmp: lancia scripts/neo-assets.ps1."
  exit 1
}
$bstrap = Join-Path $env:LOCALAPPDATA "tauri\MicrosoftEdgeWebview2Setup.exe"
if (-not (Test-Path $bstrap)) {
  Write-Output "[ERRORE] Manca il bootstrapper WebView2."
  exit 1
}
$oc = "C:\Users\giova\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe"
if (-not (Test-Path $oc)) {
  Write-Output "[ERRORE] opencode.exe non trovato: serve per il setup autonomo."
  exit 1
}
Write-Output ("motore: {0} MB" -f [math]::Round((Get-Item $oc).Length / 1MB, 1))
$mk = $null
try { $mk = (Get-Command makensis -ErrorAction SilentlyContinue).Source } catch {}
if (-not $mk) {
  $cand = Join-Path $env:LOCALAPPDATA "tauri\NSIS\makensis.exe"
  if (Test-Path $cand) { $mk = $cand }
}
if (-not $mk) {
  Write-Output "[ERRORE] makensis non trovato."
  exit 1
}
Write-Output ("makensis: {0}" -f $mk)

$kb = [int]((Get-Item $exe).Length / 1024) + 600
$outName = "ZEN-AGENT_{0}_x64-setup.exe" -f $ver
$outDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
$out = Join-Path $outDir $outName

$defs = @(
  ("/DVERSION={0}" -f $ver),
  ("/DVERSIONWITHBUILD={0}" -f $build),
  ("/DMAINBINARYSRCPATH={0}" -f $exe),
  ("/DSIDEBAR={0}" -f $side),
  ("/DINSTALLERICON={0}" -f (Join-Path $root "src-tauri\icons\icon.ico")),
  ("/DOUTFILE={0}" -f $out),
  ("/DWEBVIEW2BOOTSTRAPPERPATH={0}" -f $bstrap),
  ("/DOPENCODEEXE={0}" -f $oc),
  ("/DESTIMATEDSIZE={0}" -f $kb)
)
& $mk /V2 @defs (Join-Path $root "nsis\zen-setup.nsi")
if ($LASTEXITCODE -ne 0) {
  Write-Output "[ERRORE] makensis fallito."
  exit 1
}
$sha = (Get-FileHash $out -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output ""
Write-Output ("DARK-SETUP-OK: {0} ({1} MB) sha256={2}" -f $outName, [math]::Round((Get-Item $out).Length / 1MB, 1), $sha)
