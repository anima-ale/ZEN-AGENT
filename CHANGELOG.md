# Changelog ZEN-AGENT

## [0.4.6]
- Motore sempre il più nuovo: a runtime vince la versione maggiore tra sistema e integrato (mai più pin alla 1.19.0). Se opencode c'è già, non si installa né disinstalla nulla. Se manca ovunque, scarica sempre l'ultima via npm. Vendor aggiornato all'ultima prima di ogni build. Risposte vuote mai più mute: ora dicono che serve il login.

## [0.4.5]
- Autonomia TOTALE nel setup bianco: motore e runtime C++ integrati come risorse (niente Node/npm), exe con CRT statico, runtime auto-installato al primo avvio se manca.

## [0.4.4]
- Setup tornato a quello bianco di Tauri (con tuo logo): niente più installer scuro. Nota: senza motore e runtime integrati, su PC freschi servono Node/opencode dal sistema.

## [0.4.3]
- Setup davvero autonomo su PC resettati: runtime C++ integrato (se manca si installa da solo) + registro a 64 bit (prima le chiavi finivano nella vista a 32 bit).

## [0.4.2]
- Setup riscritto a mano in NSIS tutto scuro NEO1 (niente più pagine bianche): sidebar col logo, testi chiari su nero, oro per i titoli. Stesse cartelle/chiavi di prima + /S silenzioso per l'auto-update.

## [0.4.1]
- Logo tuo ovunque: icone exe/setup/tray rigenerate dal tuo PNG; setup con header e sidebar scuri NEO1 (nero + filetto oro).

## [0.4.0]
- Dove esce ZEN (impostazioni): sopra, sotto a sinistra sopra la barra app, lato sinistro o destro. Tracking, finestra e gesto di trascinamento seguono il bordo scelto.

## [0.3.3]
- Ombre CSS rimosse da tutte le card (goccia, pannello, snake, task, impostazioni, input): niente più ombra storta, solo bordo piatto NEO1.

## [0.3.2]
- Tolto il bordo fantasma attorno alle finestre: ombra di sistema disattivata (le card mantengono la loro ombra CSS).

## [0.3.1]
- Fix lag + terminale che lampeggia: silenziamento centralizzato in ogni lancio opencode e status in cache 60s (niente più exe da 180MB ogni 8 secondi).

## [0.3.0]
- Attività programmate: tasto orologio "attività programmate" accanto agli allegati, finestra dedicata (ogni X min/ore o ogni giorno alle HH:MM), girano anche a finestra chiusa.
- Finestra impostazioni dal gear: canale ZENdate, avvio automatico Windows, suono risposta (ding/pop/chime/muto con anteprima).
- Niente più terminale in faccia: subsystem windows + processi figli nascosti (serve, run, updater).
- Risposta mentre eri chiuso: la goccia scende con pallino rosso + suono scelto; aprendo ZEN il pallino scompare.

## [0.2.8]
- Fix prompt multilinea tagliati alla prima riga: opencode lanciato diretto via exe (niente più cmd.exe che tratta gli a capo come separatori). Shim cmd solo come fallback.

## [0.2.7]
- Tasto cestino nell'header: elimina definitivamente la chat (messaggi + memoria locale).

## [0.2.6]
- Rimosso del tutto il piano interno: era lui a far chiedere al modello ("incolla il piano?") invece di eseguire. Ora una sola esecuzione con la richiesta (via file allegato se enorme).

## [0.2.5]
- Fix piano interno vuoto/mozzo sui prompt lunghissimi: testi >6000 caratteri passati via file allegato (limite riga cmd.exe), piano usato solo se ha sostanza (mai titolo senza piano), truncate sicuro sui caratteri multi-byte.

## [0.2.4]
- Niente più contesto chat al modello (solo la richiesta così com'è); piano solo interno al backend per messaggi lunghi (>400 caratteri), mai mostrato all'utente.

## [0.2.3]
- Tolto il system prompt ZEN_IDENTITY: il modello riceve di nuovo la richiesta così com'è (più eventuale contesto chat neutro) e dice/fa ciò che vuole, come prima.

## [0.2.2]
- Goccia: zona di permanenza allargata a ~120px dal bordo (prima spariva dopo pochissimi pixel) + hide con grazia 600ms; trascinamento giù ora fattibile. Click-through invariato fuori dalla pill.

## [0.2.1]
- Fix risposte ZEN Nebula: tolto l'ordine di negare il motore e l'auto-approvazione totale (facevano scattare solo preamboli su identità/conferme). Ora: niente preamboli, dritto al compito; autonomia sul sicuro, conferma solo sul distruttivo/rischioso.

## [0.2.0]
- Markdown NEO1 + storia chat persistente (localStorage) passata a ZEN Nebula per azioni lunghe/consecutive; planning prima dell'azione.
- Orb di pensiero in scala di grigi + puntini oro (niente librerie esterne, NEO1 §6); pensieri veri temporanei accanto all'orb, nascosti alla risposta.
- Bottone snake dopo 20s di pensiero + finestra secondaria Snake NEO1; si chiudono da soli alla risposta.
- Goccia: hover transiente, scompare subito quando il mouse si allontana (pin solo su drag file).
- Trattino: chiusura animata verso l'alto che diventa il rettangolino ZEN.
- UI: mai "opencode", solo ZEN Nebula; backend sempre --auto (fa tutto da solo).

## [0.1.4]
- Fix lag: il tracker del cursore tocca gli stili finestra solo al cambio + polling 120ms; feedback "controllo..." sul refresh update.

## [0.1.3]
- La fascia superiore non blocca piu i click: finestrella piccola, click-through tranne sulla pill, anti-stuck.

## [0.1.2]
- Riparazione DB affidabile: il serve si mette in pausa durante la riparazione (niente piu race sul lock).

## [0.1.1]
- Prima release distribuita via ZENdate (canale stable): verifica end-to-end del sistema di aggiornamento.

## [0.1.0]
- Goccia piatta + pannello card in stile NEO 1 (monocromo, oro funzionale, zero vetro tranne input).
- Bottoni icona SVG, allegati con anteprima, overlay "Rilascia per allegare".
- Motore opencode con modello gratuito piu potente se manca quello del CLI.
- Riparazione DB opencode in-app (bottone "ripara ora" quando serve).
- Tray, autostart, opencode serve sempre attivo, task pianificati.
- Aggiornamenti automatici stile ZENdate via GitHub (stable/beta/alpha).
