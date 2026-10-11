@echo off
REM ZEN-AGENT - pubblica aggiornamento (Release GitHub + manifest ZENdate).
REM Uso: pubblica-update.bat [stable|beta|alpha]
REM Prima: node scripts/set-version.mjs X.Y.Z + nota in CHANGELOG.md + scripts/build-exe.bat
setlocal
cd /d "%~dp0"
set GH_REPO=anima-ale/ZEN-AGENT
set LOG=%TEMP%\zen-publish.log
echo [%DATE% %TIME%] publish ZEN-AGENT > "%LOG%"

where gh >nul 2>nul
if errorlevel 1 goto no_gh
gh auth status >>"%LOG%" 2>&1
if errorlevel 1 goto no_auth
goto have_gh

:no_gh
echo.
echo [ERRORE] GitHub CLI (gh) non trovato.
echo Installalo da https://cli.github.com poi esegui: gh auth login
echo.
pause
exit /b 1

:no_auth
echo.
echo [ERRORE] gh non autenticato. Esegui una volta: gh auth login
echo.
pause
exit /b 1

:have_gh
for /f "delims=" %%V in ('powershell -NoProfile -Command "(Get-Content package.json -Raw | ConvertFrom-Json).version"') do set VER=%%V
if "%VER%"=="" goto no_ver
echo Versione: %VER%
set TAG=v%VER%

set CHANNEL=%~1
if "%CHANNEL%"=="" set CHANNEL=stable
if not "%CHANNEL%"=="stable" if not "%CHANNEL%"=="beta" if not "%CHANNEL%"=="alpha" set CHANNEL=stable
echo Canale: %CHANNEL%
goto gen_manifest

:no_ver
echo.
echo [ERRORE] Versione non letta da package.json.
echo.
pause
exit /b 1

:gen_manifest
echo Genero manifest zendate...
powershell -NoProfile -ExecutionPolicy Bypass -File zendate\make-zendate.ps1 -Tag %TAG% -Channel %CHANNEL% >>"%LOG%" 2>&1
if errorlevel 1 goto no_manifest
set SETUP=
for %%F in ("src-tauri\target\release\bundle\nsis\*-setup.exe") do set SETUP=%%F
if "%SETUP%"=="" goto no_setup
echo Setup: %SETUP%
set NOTESFILE=zendate\%CHANNEL%\release-notes-%VER%.txt
set PREFLAG=
if not "%CHANNEL%"=="stable" set PREFLAG=--prerelease
goto ensure_repo

:no_manifest
echo.
echo [ERRORE] Generazione manifest fallita. Log: %LOG%
echo.
pause
exit /b 1

:no_setup
echo.
echo [ERRORE] Nessun setup in src-tauri\target\release\bundle\nsis.
echo Lancia prima scripts\build-exe.bat
echo.
pause
exit /b 1

:ensure_repo
gh repo view %GH_REPO% >nul 2>&1
if not errorlevel 1 goto have_repo
echo Il repo %GH_REPO% non esiste: lo creo...
gh repo create %GH_REPO% --public --confirm >>"%LOG%" 2>&1
if errorlevel 1 goto no_repo
goto have_repo

:no_repo
echo.
echo [ERRORE] Creazione repo fallita. Crea a mano https://github.com/new e riprova.
echo.
pause
exit /b 1

:have_repo
where git >nul 2>nul
if errorlevel 1 goto skip_push
if not exist ".git" (
  git init -b main >>"%LOG%" 2>&1
  git remote add origin https://github.com/%GH_REPO%.git >>"%LOG%" 2>&1
)
git config user.name >nul 2>&1
if errorlevel 1 git config user.name "ZEN-AGENT Publisher" >>"%LOG%" 2>&1
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "zen-agent@localhost" >>"%LOG%" 2>&1
git add -A >>"%LOG%" 2>&1
git diff --cached --quiet >>"%LOG%" 2>&1
if errorlevel 1 git commit -m "ZEN-AGENT v%VER%" >>"%LOG%" 2>&1
git push -u origin main >>"%LOG%" 2>&1
if errorlevel 1 git push >>"%LOG%" 2>&1
goto do_release

:skip_push
echo [AVVISO] git assente: pusha a mano codice + zendate\%CHANNEL%\zendate.json
goto do_release

:do_release
gh release view %TAG% --repo %GH_REPO% >nul 2>&1
if not errorlevel 1 goto upload_only
echo Creo la release %TAG%...
gh release create %TAG% "%SETUP%" --title "%TAG%" --notes-file "%NOTESFILE%" --repo %GH_REPO% %PREFLAG% >>"%LOG%" 2>&1
if errorlevel 1 goto no_release
goto done_ok

:upload_only
echo La release %TAG% esiste: aggiorno allegato...
gh release upload %TAG% "%SETUP%" --clobber --repo %GH_REPO% >>"%LOG%" 2>&1
if errorlevel 1 goto no_release
goto done_ok

:no_release
echo.
echo [ERRORE] Release fallita. Log: %LOG%
echo.
pause
exit /b 1

:done_ok
echo.
echo ============================================
echo   Pubblicato v%VER% (%CHANNEL%).
echo   I client si aggiorneranno da soli.
echo ============================================
echo.
pause
exit /b 0
