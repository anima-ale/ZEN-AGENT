# ZEN-AGENT

AI agentica **sempre attiva sul tuo PC, anche a tutto chiuso**, con **motore opencode**.
App `.exe` reale in **Tauri v2 + React + TypeScript**: setup che scarica tutto da solo,
modello gratuito piu potente, allegati via drag, aggiornamenti automatici stile ZENdate.

## Cosa fa (dalle tue istruzioni)

1. **Goccia dal bordo superiore** — Sfiori il lato superiore del display ed esce una
   **goccia in liquid glass che blurra cio che sta dietro** (`blur(22px) saturate(180%)`).
   La **trascini giu** (o click) e si apre la **finestrella fluttuante sopra al PC**,
   **nera che blurra lo sfondo** (`rgba(10,10,14,0.62) + blur(28px)`).
2. **Trascini un'immagine in alto** — si apre ZEN-AGENT e ti dice
   **"Rilascia per allegare"**: rilasciando, il file si allega alla domanda
   (anteprima per le immagini) e viene passato a opencode con `--file`.
3. **Da sola quando nessuno le parla**: fa **cio che le dice l'utente** — task pianificati
   (`add_task`) eseguiti in background anche a finestra chiusa, via `opencode serve` sempre attivo.
4. **Provider/modello**: usa **opencode gia installato con il modello gia messo dal CLI**.
   Se manca, imposta da solo il **gratuito piu potente**
   (`opencode/muse-spark-1.3-contributor-free`, fallback `big-pickle`, `nemotron-3-ultra-free`, ...).
5. **Aggiornamenti come KOA Browser (ZENdate)**: manifest `zendate.json` su GitHub raw
   (canali stable/beta/alpha) + download setup verificato via SHA256 + installazione
   silenziosa con riavvio automatico. Bottone UP nel pannello + check automatico giornaliero.

## Sempre attiva anche da tutto chiuso

- **System tray**: la X **nasconde**, non esce. Tray → Mostra/Esci.
- **Autostart** al login Windows (`--minimized`: solo tray + goccia).
- **Single instance**, **`opencode serve --port 4096`** sorvegliato con restart,
  **task scheduler** ogni 30s.

## Setup in 1 click (scarica TUTTO)

```bat
scripts\full-setup.bat
```

Fa: Node LTS → Rust → MSVC Build Tools → `npm i -g opencode-ai` → `npm install` →
icone → modello free → **`tauri build`** → setup `.exe` in
`src-tauri\target\release\bundle\nsis\`.

Solo ricompilare l'exe:

```bat
scripts\build-exe.bat
```

## Pubblicare un aggiornamento (stile KOA)

1. Punta ZENdate al tuo repo dedicato (una volta sola):
   `node scripts/set-zendate-repo.mjs <utente-github> <repo>`
2. `node scripts/set-version.mjs 0.2.0` (+ nota in `CHANGELOG.md`)
3. `scripts\build-exe.bat`
4. `pubblica-update.bat [stable|beta|alpha]` (richiede `gh` autenticato)

I client controllano
`https://raw.githubusercontent.com/<utente>/<repo>/main/zendate/<canale>/zendate.json`,
scaricano il setup, verificano lo SHA256 e si reinstallano da soli.

## Sviluppo

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-opencode.ps1
npm run tauri dev
```

## File chiave

- `src/drop/DropApp.tsx` — sensore 14px + goccia + drag-down + intercetta file trascinati in alto
- `src/panel/PanelApp.tsx` — chat nera blur, allegati, overlay "Rilascia per allegare", update bar
- `src-tauri/src/main.rs` — tray, autostart, serve daemon, task, ZENdate (`check_update`/`install_update`), `--file`
- `src-tauri/tauri.conf.json` — finestre `drop` (full-width, sempre sopra) + `panel` (fluttuante)
- `scripts/bootstrap-opencode.ps1` — modello free piu potente + fix `no session table`
- `zendate/make-zendate.ps1` + `pubblica-update.bat` — publish aggiornamenti
