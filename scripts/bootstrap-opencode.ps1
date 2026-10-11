#Requires -Version 5.1
# ZEN-AGENT - configura opencode da solo:
#  - ripara DB corrotto ("no session table")
#  - rispetta il modello gia messo dal CLI; se manca imposta il gratuito piu potente
# Uso: powershell -ExecutionPolicy Bypass -File scripts/bootstrap-opencode.ps1
$ErrorActionPreference = "Continue"

$FREE_PRIORITY = @(
  "opencode/muse-spark-1.3-contributor-free",
  "opencode/big-pickle",
  "opencode/nemotron-3-ultra-free",
  "opencode/exo-free",
  "opencode/space-bunny-free",
  "opencode/longcat-2.5-preview-free",
  "opencode/step-5-preview-free"
)
$DEFAULT_MODEL = $FREE_PRIORITY[0]
$DEFAULT_SMALL = "opencode/nemotron-3.5-lightning-free"

Write-Host "=== ZEN-AGENT - setup opencode ===" -ForegroundColor Cyan

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
  Write-Host "opencode non trovato, lo installo..." -ForegroundColor Yellow
  cmd /c "npm i -g opencode-ai@latest"
}

# --- ripara DB corrotto ---
$probe = cmd /c "opencode models 2>&1"
if ($probe -match "no session table") {
  Write-Host "DB opencode corrotto: backup + reset..." -ForegroundColor Yellow
  $data = Join-Path $HOME ".local\share\opencode"
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $data "backup-corruptdb-$ts"
  New-Item -ItemType Directory -Force -Path $backup | Out-Null
  foreach ($f in @("opencode.db","opencode.db-shm","opencode.db-wal")) {
    $src = Join-Path $data $f
    if (Test-Path $src) {
      try { Move-Item -Force $src (Join-Path $backup $f) -ErrorAction Stop }
      catch {
        Write-Host "NOTA: $f e in uso (opencode aperto?). Chiudi l'app OpenCode e rilancia questo script per completare la riparazione del DB." -ForegroundColor Yellow
      }
    }
  }
  Write-Host "Backup in $backup" -ForegroundColor Green
}

# --- modello: rispetta quello del CLI, altrimenti gratuito piu potente ---
$cfgDir = Join-Path $HOME ".config\opencode"
$cfg = Join-Path $cfgDir "opencode.jsonc"
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null

$existing = ""
if (Test-Path $cfg) {
  $q = [char]34
  foreach ($line in (Get-Content $cfg)) {
    $t = $line.Trim().Trim(',')
    if ($t.StartsWith($q + 'model' + $q)) {
      $existing = ($t -split ':')[1].Trim().Trim(',').Trim($q)
    }
  }
}

if ($existing -ne "") {
  Write-Host "Modello gia impostato dal CLI: $existing (lo rispetto)" -ForegroundColor Green
} else {
  # Prova a scegliere il primo free disponibile dal catalogo Zen, fallback al default
  $chosen = $DEFAULT_MODEL
  try {
    $models = Invoke-RestMethod -Uri "https://opencode.ai/zen/v1/models" -TimeoutSec 15
    $ids = @()
    if ($models.data) { $ids = $models.data | ForEach-Object { $_.id } }
    elseif ($models.models) { $ids = $models.models | ForEach-Object { $_.id } }
    foreach ($cand in $FREE_PRIORITY) {
      $short = ($cand -split "/",2)[1]
      if ($ids -contains $short -or $ids -contains $cand) { $chosen = $cand; break }
    }
  } catch { Write-Host "Catalogo Zen non raggiungibile, uso default $DEFAULT_MODEL" -ForegroundColor DarkGray }

  $json = @"
{
  "`$schema": "https://opencode.ai/config.json",
  "model": "$chosen",
  "small_model": "$DEFAULT_SMALL"
}
"@
  Set-Content -Path $cfg -Value $json -Encoding UTF8
  Write-Host "Modello gratuito piu potente impostato: $chosen" -ForegroundColor Green
}

Write-Host "Verifica: $(cmd /c opencode --version)" -ForegroundColor Cyan
Write-Host "=== OK ===" -ForegroundColor Green
