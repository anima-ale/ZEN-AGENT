# Changelog ZEN-AGENT

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
