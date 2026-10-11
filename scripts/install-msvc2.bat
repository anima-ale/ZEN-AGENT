@echo off
REM ZEN-AGENT - installa MSVC via bootstrapper ufficiale (bypassa record winget orfano).
set LOG=%TEMP%\zen-msvc2.log
set EXE=%TEMP%\vs_BuildTools.exe
echo [%DATE% %TIME%] download bootstrapper > "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dl-vsbt.ps1" >> "%LOG%" 2>&1
if not exist "%EXE%" (
  echo [msvc] ERRORE download bootstrapper >> "%LOG%"
  echo [msvc] ERRORE download
  exit /b 1
)
echo [msvc] avvio installazione VCTools (10-30 min)...
"%EXE%" --wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended >> "%LOG%" 2>&1
echo [msvc] exit code installazione: %ERRORLEVEL% >> "%LOG%"
if exist "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" (
  echo [msvc] OK vswhere presente.
  exit /b 0
)
if exist "C:\Program Files\Microsoft Visual Studio\Installer\vswhere.exe" (
  echo [msvc] OK vswhere presente.
  exit /b 0
)
echo [msvc] VERIFICA FALLITA, vedi %LOG%
exit /b 1
