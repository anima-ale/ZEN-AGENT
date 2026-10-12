; ============================================================
; ZEN-AGENT — installer NSIS scritto a mano, stile NEO1.
; Tutto scuro: pagine custom nsDialogs, niente MUI, niente bianco.
; Compilare con (vedi scripts/build-dark-setup.ps1):
;   makensis /DVERSION=0.4.2 /DVERSIONWITHBUILD=0.4.2.0
;     /DMAINBINARYSRCPATH=... /DSIDEBAR=... /DINSTALLERICON=...
;     /DOUTFILE=... /DWEBVIEW2BOOTSTRAPPERPATH=... /DESTIMATEDSIZE=0x...
;     nsis/zen-setup.nsi
; Supporta /S silenzioso (usato dall'auto-aggiornamento).
; ============================================================

Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
SetCompressor /SOLID lzma
RequestExecutionLevel user
; Contesto per-utente (default): start menu, desktop e registro HKCU dell'utente

!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!include "StrFunc.nsh"
${StrLoc}
${Using:StrFunc} UnStrLoc

!define PRODUCTNAME "ZEN-AGENT"
!define BUNDLEID "com.zen.agent"
!define MANUFACTURER "zen"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZEN-AGENT"
!define MANUKEY "Software\zen"
!define MANUPRODUCTKEY "Software\zen\ZEN-AGENT"
!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define STARTMENUFOLDER "ZEN-AGENT"

; --- NEO1: nero caldo, grigi, un solo oro ---
!define NEO_BG "0x0A0A09"
!define NEO_FG "0xF0F0F0"
!define NEO_SUB "0x9A9A9A"
!define NEO_GOLD "0xE8B04B"
; InstallColors vuole esadecimali senza 0x
!define NEO_BG6 "0A0A09"
!define NEO_FG6 "F0F0F0"

Name "${PRODUCTNAME} ${VERSION}"
Caption "${PRODUCTNAME} ${VERSION} — Installazione"
BrandingText ""
Icon "${INSTALLERICON}"
UninstallIcon "${INSTALLERICON}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\${PRODUCTNAME}"

VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "zen"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

; Dettagli installazione scuri (pagina instfiles, anche uninstaller)
InstallColors "${NEO_FG6}" "${NEO_BG6}"
ShowInstDetails show
ShowUninstDetails show

Var DirReq
Var RunCheck
Var DeskCheck
Var DataCheck
Var DataHwnd

; ---------- pagina scura base ----------
!macro ZEN_DARK_DIALOG
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $0 "${NEO_FG}" "${NEO_BG}"
!macroend

!macro ZEN_SIDEBAR
  ${NSD_CreateBitmap} 0 0 82u 120u ""
  Pop $1
  SetCtlColors $1 "${NEO_FG}" "${NEO_BG}"
  ${NSD_SetImage} $1 "$TEMP\zen-side.bmp" $9
!macroend

!macro ZEN_TITLE text
  ${NSD_CreateLabel} 94u 10u -10u 18u "${text}"
  Pop $1
  SetCtlColors $1 "${NEO_GOLD}" "${NEO_BG}"
!macroend

; ============================================================
; INSTALLER
; ============================================================

Function .onInit
  ; Sidebar scura per le pagine
  File "/oname=$TEMP\zen-side.bmp" "${SIDEBAR}"
  ; Ripristina la cartella precedente (update /S)
  ReadRegStr $R0 HKCU "${MANUPRODUCTKEY}" ""
  ${If} $R0 != ""
    StrCpy $INSTDIR $R0
  ${EndIf}
FunctionEnd

Page custom pgWelcome pgWelcomeLeave
Page custom pgDir pgDirLeave
Page instfiles
Page custom pgFinish pgFinishLeave

Function pgWelcome
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro ZEN_DARK_DIALOG
  !insertmacro ZEN_SIDEBAR
  !insertmacro ZEN_TITLE "ZEN-AGENT ${VERSION}"
  ${NSD_CreateLabel} 94u 30u -10u 10u "AI agentica sempre attiva sul tuo PC."
  Pop $1
  SetCtlColors $1 "${NEO_SUB}" "${NEO_BG}"
  ${NSD_CreateLabel} 94u 48u -10u 80u "Goccia dal bordo + pannello fluttuante, motore integrato, attività programmate anche a finestra chiusa.$\r$\n$\r$\nPremi Avanti per installare."
  Pop $1
  SetCtlColors $1 "${NEO_FG}" "${NEO_BG}"
  nsDialogs::Show
FunctionEnd
Function pgWelcomeLeave
FunctionEnd

Function pgDir
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro ZEN_DARK_DIALOG
  ${NSD_CreateLabel} 0 4u 100% 12u "Cartella di installazione:"
  Pop $1
  SetCtlColors $1 "${NEO_SUB}" "${NEO_BG}"
  ${NSD_CreateDirRequest} 0 20u -64u 12u "$INSTDIR"
  Pop $DirReq
  SetCtlColors $DirReq "${NEO_FG}" "${NEO_BG}"
  ${NSD_CreateBrowseButton} -60u 19u 60u 14u "Sfoglia..."
  Pop $1
  ${NSD_OnNotify} $1 OnBrowse
  nsDialogs::Show
FunctionEnd
Function OnBrowse
  Pop $0
  nsDialogs::SelectFolderDialog "Scegli la cartella" "$INSTDIR"
  Pop $0
  ${If} $0 != "error"
    StrCpy $INSTDIR $0
    ${NSD_SetText} $DirReq $INSTDIR
  ${EndIf}
FunctionEnd
Function pgDirLeave
  ${NSD_GetText} $DirReq $INSTDIR
  ${If} $INSTDIR == ""
    MessageBox MB_ICONEXCLAMATION "Scegli una cartella di installazione."
    Abort
  ${EndIf}
FunctionEnd

Function pgFinish
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro ZEN_DARK_DIALOG
  !insertmacro ZEN_SIDEBAR
  !insertmacro ZEN_TITLE "Installazione completata"
  ${NSD_CreateLabel} 94u 34u -10u 30u "ZEN-AGENT è pronto. La trovi nella tray e dal bordo che hai scelto."
  Pop $1
  SetCtlColors $1 "${NEO_FG}" "${NEO_BG}"
  ${NSD_CreateCheckbox} 94u 72u -10u 10u "Avvia ZEN-AGENT ora"
  Pop $RunCheck
  SetCtlColors $RunCheck "${NEO_FG}" "${NEO_BG}"
  SendMessage $RunCheck ${BM_SETCHECK} ${BST_CHECKED} 0
  ${NSD_CreateCheckbox} 94u 86u -10u 10u "Crea collegamento sul desktop"
  Pop $DeskCheck
  SetCtlColors $DeskCheck "${NEO_FG}" "${NEO_BG}"
  nsDialogs::Show
FunctionEnd
Function pgFinishLeave
  ${NSD_GetState} $RunCheck $0
  ${If} $0 == ${BST_CHECKED}
    Exec '"$INSTDIR\ZEN-AGENT.exe"'
  ${EndIf}
  ${NSD_GetState} $DeskCheck $0
  ${If} $0 == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCTNAME}.exe"
  ${EndIf}
FunctionEnd

; $0 = 1 se ZEN-AGENT gira, 0 se no (nascosto, niente flash)
Function IsAppRunning
  Push $R0
  Push $R1
  Push $R2
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ZEN-AGENT.exe" /FO LIST'
  Pop $R0
  Pop $R1
  StrCpy $R2 0
  ${StrLoc} $R0 $R1 "ZEN-AGENT.exe" ">"
  ${If} $R0 != ""
    StrCpy $R2 1
  ${EndIf}
  StrCpy $0 $R2
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

; Chiude l'app se gira: in silent la killa, in GUI chiede Riprova.
Function KillOrAskApp
  Call IsAppRunning
  ${If} $0 == 1
    ${If} ${Silent}
      ExecWait '"$SYSDIR\taskkill.exe" /F /IM ZEN-AGENT.exe' $1
      Sleep 1500
      Call IsAppRunning
      ${If} $0 == 1
        Abort "ZEN-AGENT è in esecuzione e non si chiude."
      ${EndIf}
    ${Else}
      ask_loop:
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "ZEN-AGENT è in esecuzione.$\r$\nChiudilo (tray -> Esci) e premi Riprova." IDRETRY ask_retry IDCANCEL ask_cancel
      ask_cancel:
        Quit
      ask_retry:
        Call IsAppRunning
        ${If} $0 == 1
          Goto ask_loop
        ${EndIf}
    ${EndIf}
  ${EndIf}
FunctionEnd

Section "WebView2"
  ${If} ${RunningX64}
    ReadRegStr $4 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${Else}
    ReadRegStr $4 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}
  ${If} $4 == ""
    ReadRegStr $4 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}
  ${If} $4 == ""
    DetailPrint "Installo WebView2..."
    Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
    File "/oname=$TEMP\MicrosoftEdgeWebview2Setup.exe" "${WEBVIEW2BOOTSTRAPPERPATH}"
    ExecWait '"$TEMP\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
    ${If} $1 == 0
      DetailPrint "WebView2 ok."
    ${Else}
      Abort "Installazione WebView2 fallita."
    ${EndIf}
  ${Else}
    DetailPrint "WebView2 già presente."
  ${EndIf}
SectionEnd

Section "ZEN-AGENT"
  Call KillOrAskApp
  SetOutPath $INSTDIR
  DetailPrint "Copia ZEN-AGENT.exe..."
  Delete "$INSTDIR\${PRODUCTNAME}.exe"
  File "${MAINBINARYSRCPATH}"
  ; Motore integrato: setup autonomo, niente Node/npm richiesti
  DetailPrint "Copia motore opencode..."
  Delete "$INSTDIR\opencode.exe"
  File "${OPENCODEEXE}"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "${MANUPRODUCTKEY}" "" $INSTDIR
  WriteRegStr HKCU "${UNINSTKEY}" "MainBinaryName" "${PRODUCTNAME}.exe"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" '"$INSTDIR\${PRODUCTNAME}.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${MANUFACTURER}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" '"$INSTDIR"'
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "${ESTIMATEDSIZE}"
  CreateDirectory "$SMPROGRAMS\${STARTMENUFOLDER}"
  CreateShortcut "$SMPROGRAMS\${STARTMENUFOLDER}\${PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCTNAME}.exe"
  DetailPrint "Fatto."
SectionEnd

; ============================================================
; UNINSTALLER
; ============================================================

Function un.onInit
  File "/oname=$TEMP\zen-side.bmp" "${SIDEBAR}"
  StrCpy $DataCheck 0
FunctionEnd

UninstPage custom un.Confirm un.ConfirmLeave
UninstPage instfiles

Function un.Confirm
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro ZEN_DARK_DIALOG
  !insertmacro ZEN_SIDEBAR
  !insertmacro ZEN_TITLE "Disinstalla ZEN-AGENT"
  ${NSD_CreateLabel} 94u 34u -10u 30u "Rimuovere ZEN-AGENT dal PC?"
  Pop $1
  SetCtlColors $1 "${NEO_FG}" "${NEO_BG}"
  ${NSD_CreateCheckbox} 94u 72u -10u 10u "Elimina anche dati e impostazioni"
  Pop $DataHwnd
  SetCtlColors $DataHwnd "${NEO_FG}" "${NEO_BG}"
  nsDialogs::Show
FunctionEnd
Function un.ConfirmLeave
  ${NSD_GetState} $DataHwnd $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $DataCheck 1
  ${Else}
    StrCpy $DataCheck 0
  ${EndIf}
FunctionEnd

Function un.KillOrAskApp
  Call un.IsAppRunning
  ${If} $0 == 1
    ${If} ${Silent}
      ExecWait '"$SYSDIR\taskkill.exe" /F /IM ZEN-AGENT.exe' $1
      Sleep 1500
    ${Else}
      un_ask_loop:
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "ZEN-AGENT è in esecuzione.$\r$\nChiudilo (tray -> Esci) e premi Riprova." IDRETRY un_ask_retry IDCANCEL un_ask_cancel
      un_ask_cancel:
        Quit
      un_ask_retry:
        Call un.IsAppRunning
        ${If} $0 == 1
          Goto un_ask_loop
        ${EndIf}
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.IsAppRunning
  Push $R0
  Push $R1
  Push $R2
  nsExec::ExecToStack '"$SYSDIR\tasklist.exe" /FI "IMAGENAME eq ZEN-AGENT.exe" /FO LIST'
  Pop $R0
  Pop $R1
  StrCpy $R2 0
  ${UnStrLoc} $R0 $R1 "ZEN-AGENT.exe" ">"
  ${If} $R0 != ""
    StrCpy $R2 1
  ${EndIf}
  StrCpy $0 $R2
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

Section "Uninstall"
  Call un.KillOrAskApp
  Delete "$INSTDIR\${PRODUCTNAME}.exe"
  Delete "$INSTDIR\opencode.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${STARTMENUFOLDER}\${PRODUCTNAME}.lnk"
  RMDir "$SMPROGRAMS\${STARTMENUFOLDER}"
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${If} $DataCheck == 1
    DeleteRegKey HKCU "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKCU "${MANUKEY}"
    RMDir /r "$APPDATA\${BUNDLEID}"
    RMDir /r "$LOCALAPPDATA\${BUNDLEID}"
  ${EndIf}
SectionEnd
