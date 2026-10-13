# Changelog ZEN-AGENT

## [0.7.4]
- Ingranaggio ripristinato nel pannello (tolto per errore). Via solo il pulsante "rispondi a zen" dalle impostazioni; microfonino sempre fuori, voce sempre spenta.

## [0.7.3]
- Voce staccata per ora: via microfonino e ingranaggio dal pannello, via voce dal tray, niente hotkey, wake-word sempre spenta (codice dormiente, torna quando vuoi).
- Blindatura dati: cartella dati leggibile dal solo utente (ACL), attività e cache offuscate su disco con migrazione automatica.

## [0.7.2]
- TITAN anti-loop: un trigger alla volta, 2s di calma dopo ogni chiusura, generazioni di sessione (chiusure e parole orfane ignorate), wake che riparte dopo la chiusura. La finestrella non flasha più e la X chiude davvero.

## [0.7.1]
- Splitter vocale corretto: la "e" solitaria non spezza più le liste ("q1.txt e q2.txt" resta unito), aggiunte varianti "e dopo/e quindi/e allora". I frammenti ereditano il pezzo prima come contesto.

## [0.7.0]
- TITAN simultaneo: capisce ed esegue mentre parli (ogni azione completa parte subito in parallelo, riepilogo parlato alla fine). Endpointing a 1,2s per i comandi secchi. Chiusura automatica dopo 10s senza parole per lui.

## [0.6.0]
- ZEN TITAN (voce, integrato): finestrella con visualizzatore audio, wake-word "zen" sempre in ascolto (disattivabile), hotkey Ctrl+Shift+Z, pulsante microfono nel pannello e voce nel menu tray. Esegue tutto come la chat e risponde parlando; si chiude da sola alla fine.

## [0.5.0]
- Giro di polish: telefono in coda se ZEN è occupato (niente più "riprova"), pagina telefono con scadenza anti-poll infinito, scroll libero nelle ausiliarie già incluso, pulizia file di test.

## [0.4.16]
- Allegati riparati: il `--file` va dopo il prompt (prima il motore cercava il prompt come file). Path sempre assoluti, controllo esistenza con messaggio chiaro, immagini oltre 10 MB compresse da sole, stop alle HEIC illeggibili.

## [0.4.15]
- Risposte pulitissime: le righe OK oro restano solo live e spariscono alla fine (resta una riga sobria "✓ fatto (N attività)" + esito secco). Dettagli tecnici nascosti (niente codice nelle righe), regola finale più dura con italiano obbligatorio.

## [0.4.14]
- Fix scroll vero nelle finestre ausiliarie: il drag della finestra resta solo sull'intestazione, il corpo scorre libero fino in fondo con rotella e barra.

## [0.4.13]
- Telefono fuori-casa: nuovo tasto nelle impostazioni che apre un tunnel internet (Cloudflare, scaricato e verificato solo su richiesta) con secondo QR valido su qualsiasi rete. Fix scroll impostazioni (mancava min-height:0) + finestra più alta.

## [0.4.12]
- Fix server telefono: le connessioni ereditavano il non-blocking del listener e non rispondevano mai. Ora tornano bloccanti e la pagina mobile funziona.

## [0.4.11]
- Collega-telefono: nelle impostazioni il tasto crea-QR accende un mini-server con token e mostra QR + link. Scannerizzi con qualsiasi telefono (stesso Wi-Fi), scrivi nella pagina e il messaggio entra nella sessione aperta sul PC con risposta che torna anche al telefono.

## [0.4.10]
- Anti-narrazione: regola fissa davanti a ogni richiesta (chat e programmate) + scarto del testo pre-azione quando usa strumenti. Restano solo fatti e conferme: ideale per "apri chrome" e domande velocissime.

## [0.4.9]
- Corsia veloce: il diretto batte l'attach di ~2,5s, ora è sempre primo (attach solo di scorta). Cache risposte su disco: prompt identico e breve risponde istantaneo senza rete (TTL 24h). Warm-up gratis all'avvio: prima domanda senza costi di avvio a freddo.

## [0.4.8]
- Run live come nel video: conferma "▶ ZEN ha iniziato…", poi riga oro numerata `OK "ATTIVITÀ n" COMPLETATA` per ogni passo finito. Pensieri in grigio nella barra (tracce di attività live, spariscono alla risposta: il reasoning interno del provider è cifrato e non leggibile).

## [0.4.7]
- Pensiero sempre al minimo: ogni run usa `--variant minimal` (reasoning effort ridotto, risposta quasi istantanea), anche nelle attività programmate. Se un provider rifiuta la variante, scala da solo senza rompere nulla.

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
