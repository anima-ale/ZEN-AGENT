@echo off
REM ZEN-AGENT - installa MSVC Build Tools da solo (serve per compilare Tauri).
REM Log in %TEMP%\zen-msvc.log
set LOG=%TEMP%\zen-msvc.log
echo [%DATE% %TIME%] avvio check MSVC > "%LOG%"
where cl >> "%LOG%" 2>&1
if not errorlevel 1 (
  echo MSVC gia presente, salto installazione. >> "%LOG%"
  cl 2>&1 | findstr /C:"Version" >> "%LOG%"
  echo [msvc] gia installato, skip.
  exit /b 0
)
echo [msvc] installo Visual Studio 2022 Build Tools con workload C++...
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [msvc] ERRORE installazione, vedi %LOG%
  exit /b 1
)
echo [msvc] installazione completata.
exit /b 0
