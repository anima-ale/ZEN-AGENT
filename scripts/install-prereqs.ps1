#Requires -Version 5.1
# ZEN-AGENT - installa TUTTO automaticamente: Node LTS, Rust, opencode, WebView2 check.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/install-prereqs.ps1
$ErrorActionPreference = "Continue"

function Test-Cmd($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

Write-Host "=== ZEN-AGENT - prerequisiti ===" -ForegroundColor Cyan

# 1. Node LTS via winget
if (-not (Test-Cmd "node")) {
  Write-Host "[1/4] Installo Node LTS..." -ForegroundColor Yellow
  if (Test-Cmd "winget") {
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  } else {
    Write-Host "winget non trovato: scarica Node LTS da https://nodejs.org e rilancia." -ForegroundColor Red
  }
} else { Write-Host "[1/4] Node ok: $(node -v)" -ForegroundColor Green }

# 2. Rust via rustup-init
if (-not (Test-Cmd "cargo")) {
  Write-Host "[2/4] Installo Rust (rustup)..." -ForegroundColor Yellow
  $init = "$env:TEMP\rustup-init.exe"
  try {
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $init -UseBasicParsing
    Start-Process -FilePath $init -ArgumentList "-y","--default-toolchain","stable" -Wait
    $cargo = "$env:USERPROFILE\.cargo\bin"
    if ($env:Path -notlike "*$cargo*") { $env:Path += ";$cargo" }
  } catch { Write-Host "Rust install fallita: $_" -ForegroundColor Red }
} else { Write-Host "[2/4] Rust ok: $(cargo --version)" -ForegroundColor Green }

# 3. VS Build Tools (serve il linker MSVC per Tauri)
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
  $cc = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  if (-not $cc) { Write-Host "[3/4] ATTENZIONE: MSVC non trovato. Installo Build Tools..." -ForegroundColor Yellow }
  else { Write-Host "[3/4] MSVC ok." -ForegroundColor Green }
} else {
  Write-Host "[3/4] vswhere assente: se la build Tauri fallisce installa 'Visual Studio Build Tools' + workload C++." -ForegroundColor Yellow
  Write-Host "      winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override '--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive'" -ForegroundColor DarkGray
}

# 4. opencode
if (-not (Test-Cmd "opencode")) {
  Write-Host "[4/4] Installo opencode..." -ForegroundColor Yellow
  cmd /c "npm i -g opencode-ai@latest"
} else { Write-Host "[4/4] opencode ok: $(cmd /c opencode --version)" -ForegroundColor Green }

# 5. Dipendenze npm del progetto
Write-Host "Installo dipendenze npm..." -ForegroundColor Cyan
cmd /c "npm install"

Write-Host "=== Fatto. Ora: powershell -ExecutionPolicy Bypass -File scripts/bootstrap-opencode.ps1 ===" -ForegroundColor Cyan
