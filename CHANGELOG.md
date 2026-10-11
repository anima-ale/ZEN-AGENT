# Changelog ZEN-AGENT

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
