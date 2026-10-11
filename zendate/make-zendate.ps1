# ZENdate per ZEN-AGENT - genera il manifest per spedire un aggiornamento.
# Stesso formato di KOA Browser: { version, notes, url, sha256 }.
# Uso:
#   powershell -ExecutionPolicy Bypass -File zendate\make-zendate.ps1 -Tag v0.2.0 -Channel stable
param(
  [string]$Url = "",
  [string]$User = "anima-ale",
  [string]$Repo = "ZEN-AGENT",
  [string]$Tag = "",
  [string]$Version = "",
  [string]$Notes = "",
  [string]$Channel = "stable",
  [string]$Out = ""
)

$kitDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $kitDir
if ($Channel -notin @('stable', 'beta', 'alpha')) { $Channel = 'stable' }
if ([string]::IsNullOrWhiteSpace($Out)) { $Out = Join-Path (Join-Path $kitDir $Channel) 'zendate.json' }
$chanDir = Split-Path -Parent $Out
if (-not (Test-Path $chanDir)) { New-Item -ItemType Directory -Force $chanDir | Out-Null }

# 1. Versione da package.json (bumparla PRIMA della build con node scripts/set-version.mjs)
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$pkgVersion = $pkg.version
if ([string]::IsNullOrWhiteSpace($Version)) { $Version = $pkgVersion }

# 2. Trova il setup NSIS piu recente in src-tauri/target/release/bundle/nsis
$nsisDir = Join-Path $root 'src-tauri\target\release\bundle\nsis'
$exe = Get-ChildItem $nsisDir -Filter '*-setup.exe' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $exe) {
  Write-Output '[ERRORE] Nessun setup in src-tauri\target\release\bundle\nsis. Lancia prima npm run tauri build'
  exit 1
}
$m = [regex]::Match($exe.Name, '(\d+(?:\.\d+)+)')
if ($m.Success -and $m.Groups[1].Value -ne $Version) {
  Write-Output ("[AVVISO] Il setup dice v{0} ma usi v{1}: controlla il bump di versione" -f $m.Groups[1].Value, $Version)
}

# 3. Note di release: da CHANGELOG.md se -Notes e vuoto
if ([string]::IsNullOrWhiteSpace($Notes)) {
  $clPath = Join-Path $root 'CHANGELOG.md'
  if (Test-Path $clPath) {
    $buf = @()
    $cap = $false
    foreach ($ln in (Get-Content $clPath -Encoding UTF8)) {
      if ($ln -match '^\s*##\s*\[?([0-9][0-9A-Za-z\.\-]*)\]?\s*(-.*)?$') {
        if ($cap) { break }
        if ($Matches[1] -eq $Version) { $cap = $true }
        continue
      }
      if ($cap) { $buf += $ln }
    }
    $Notes = ($buf -join "`n").Trim("`n", ' ', "`r")
  }
}
$notesFile = Join-Path (Join-Path $kitDir $Channel) ('release-notes-' + $Version + '.txt')
[IO.File]::WriteAllText($notesFile, $Notes, (New-Object Text.UTF8Encoding $false))

# 4. URL pubblico del setup
$FinalUrl = $Url
if ([string]::IsNullOrWhiteSpace($FinalUrl)) {
  if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Repo) -or [string]::IsNullOrWhiteSpace($Tag)) {
    Write-Output '[ERRORE] Servono -User + -Repo + -Tag (es. -Tag v0.2.0)'
    exit 1
  }
  $FinalUrl = 'https://github.com/' + $User + '/' + $Repo + '/releases/download/' + $Tag + '/' + ($exe.Name -replace '\s', '.')
}

# 5. SHA256 del setup
$hash = (Get-FileHash $exe.FullName -Algorithm SHA256).Hash.ToLowerInvariant()

# 6. Scrivi il manifest (UTF-8 senza BOM)
$manifest = [ordered]@{
  version = $Version
  notes   = $Notes
  url     = $FinalUrl
  sha256  = $hash
}
[IO.File]::WriteAllText($Out, ($manifest | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))

Write-Output ''
Write-Output 'zendate.json pronto:'
Write-Output ("  versione : {0}" -f $Version)
Write-Output ("  setup    : {0} ({1} MB)" -f $exe.Name, [math]::Round($exe.Length / 1MB, 1))
Write-Output ("  sha256   : {0}" -f $hash)
Write-Output ("  url      : {0}" -f $FinalUrl)
Write-Output ("  file     : {0}" -f $Out)
Write-Output ''
Write-Output 'Prossimi passi: pubblica-update.bat crea la Release e pusha il manifest.'
