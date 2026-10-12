import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const P = { minus: "M5 12h14" };

const SOUNDS = [
  { id: "ding", label: "ding" },
  { id: "pop", label: "pop" },
  { id: "chime", label: "chime" },
  { id: "off", label: "muto" },
] as const;

const POSITIONS = [
  { id: "top", label: "sopra" },
  { id: "bottom", label: "sotto a sx" },
  { id: "left", label: "sinistra" },
  { id: "right", label: "destra" },
] as const;

function preview(kind: string) {
  if (kind === "off") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const seqs: Record<string, Array<[number, number, number]>> = {
      ding: [[880, 0, 0.35]],
      pop: [[520, 0, 0.12], [780, 0.1, 0.18]],
      chime: [[660, 0, 0.25], [880, 0.18, 0.3], [1320, 0.36, 0.4]],
    };
    const seq = seqs[kind] ?? seqs.ding;
    for (const [freq, at, dur] of seq) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t0 = ctx.currentTime + at;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    window.setTimeout(() => ctx.close().catch(() => undefined), 2500);
  } catch {
    /* niente audio: ignora */
  }
}

export default function SettingsApp() {
  const [channel, setChannel] = useState("stable");
  const [auto, setAuto] = useState(true);
  const [sound, setSound] = useState("ding");
  const [pos, setPos] = useState("top");
  const [msg, setMsg] = useState("");
  const [phoneUrl, setPhoneUrl] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [remoteState, setRemoteState] = useState("off");
  const [qrOk, setQrOk] = useState(true);

  const syncPhone = useCallback(async () => {
    try {
      const ph = await api.phoneStatus();
      setPhoneUrl(ph.running ? ph.url : null);
      setRemoteUrl(ph.public_url || null);
      setRemoteState(ph.remote || "off");
    } catch { /* ignora */ }
  }, []);

  const reload = useCallback(async () => {
    try {
      setChannel(await api.getChannel());
    } catch { /* ignora */ }
    try {
      setAuto(await api.getAutostart());
    } catch { /* ignora */ }
    try {
      setSound(await api.getSound());
    } catch { /* ignora */ }
    try {
      setPos(await api.getDropPosition());
    } catch { /* ignora */ }
    try {
      const ph = await api.phoneStatus();
      setPhoneUrl(ph.running ? ph.url : null);
      setRemoteUrl(ph.public_url || null);
      setRemoteState(ph.remote || "off");
    } catch { /* ignora */ }
  }, []);

  useEffect(() => {
    reload();
    // Mentre le impostazioni sono aperte, aggiorna QR e stato tunnel.
    const t = window.setInterval(() => {
      syncPhone();
    }, 2000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api.hideSettings().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [reload, syncPhone]);

  const changeChannel = async (c: string) => {
    try {
      await api.setChannel(c);
      setChannel(c);
      setMsg(`canale ${c}: il prossimo controllo cercherà lì.`);
    } catch (e) {
      setMsg("cambio canale fallito: " + String(e));
    }
  };

  const toggleAuto = async () => {
    try {
      await api.setAutostart(!auto);
      setAuto(!auto);
    } catch (e) {
      setMsg("avvio automatico fallito: " + String(e));
    }
  };

  const changeSound = async (s: string) => {
    try {
      await api.setSound(s);
      setSound(s);
      preview(s);
    } catch (e) {
      setMsg("suono fallito: " + String(e));
    }
  };

  const changePos = async (p: string) => {
    try {
      await api.setDropPosition(p);
      setPos(p);
      setMsg("posizione ZEN aggiornata.");
    } catch (e) {
      setMsg("posizione fallita: " + String(e));
    }
  };

  const togglePhone = async () => {
    try {
      if (phoneUrl) {
        await api.phoneStop();
        setPhoneUrl(null);
        setMsg("collegamento telefono spento.");
      } else {
        const url = await api.phoneStart();
        setPhoneUrl(url);
        setMsg("scannerizza il QR con il telefono (stesso Wi-Fi).");
      }
    } catch (e) {
      setMsg("telefono fallito: " + String(e));
    }
  };

  const copyPhone = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("link copiato negli appunti.");
    } catch {
      setMsg(url);
    }
  };

  const toggleRemote = async () => {
    try {
      if (remoteState === "pronto" || remoteState === "avvio") {
        await api.phoneRemoteStop();
        setRemoteUrl(null);
        setRemoteState("off");
        setMsg("fuori-casa spento.");
      } else {
        setRemoteState("avvio");
        setMsg("fuori-casa in avvio (scarica il tunnel la prima volta)...");
        await api.phoneRemoteStart();
      }
    } catch (e) {
      setRemoteState("off");
      setMsg("fuori-casa fallito: " + String(e));
    }
  };

  return (
    <div id="aux-root">
      <div id="aux-card">
        <div id="aux-header">
          <span id="aux-title">IMPOSTAZIONI</span>
          <button className="icon-btn" title="Chiudi" onClick={() => api.hideSettings().catch(() => undefined)}>
            <Icon d={P.minus} />
          </button>
        </div>

        <div id="aux-body">
          <div className="aux-label">CANALE AGGIORNAMENTI</div>
          <div id="set-row">
            {(["stable", "beta", "alpha"] as const).map((c) => (
              <button key={c} className={`chan ${channel === c ? "on" : ""}`} onClick={() => changeChannel(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="aux-label">AVVIO</div>
          <label id="set-auto">
            <input type="checkbox" checked={auto} onChange={toggleAuto} />
            avvia sempre all'avvio di Windows
          </label>

          <div className="aux-label">SUONO RISPOSTA PRONTA</div>
          <div id="set-row">
            {SOUNDS.map((s) => (
              <button key={s.id} className={`chan ${sound === s.id ? "on" : ""}`} onClick={() => changeSound(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="aux-label">DOVE ESCE ZEN</div>
          <div id="set-row">
            {POSITIONS.map((p) => (
              <button key={p.id} className={`chan ${pos === p.id ? "on" : ""}`} onClick={() => changePos(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="aux-label">TELEFONO</div>
          <div id="set-row">
            <button className={`chan ${phoneUrl ? "on" : ""}`} onClick={togglePhone}>
              {phoneUrl ? "scollega telefono" : "crea QR collega-telefono"}
            </button>
          </div>
          {phoneUrl && (
            <div id="phone-qr">
              <div id="phone-qr-img">
                {qrOk ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(phoneUrl)}`}
                    alt="QR collega-telefono"
                    onError={() => {
                      setQrOk(false);
                      setMsg("QR online non caricato: usa il link copiato.");
                    }}
                  />
                ) : (
                  <div id="phone-noqr">QR non disponibile: copia il link sotto</div>
                )}
              </div>
              <div id="phone-url">{phoneUrl}</div>
              <button className="chan" onClick={() => copyPhone(phoneUrl)}>copia link</button>
              <div id="phone-note">stesso Wi-Fi del PC · chi ha il QR può scrivere a ZEN</div>
            </div>
          )}

          <div className="aux-label">TELEFONO FUORI CASA</div>
          <div id="set-row">
            <button
              className={`chan ${remoteState === "pronto" || remoteState === "avvio" ? "on" : ""}`}
              onClick={toggleRemote}
              disabled={!phoneUrl}
            >
              {remoteState === "pronto" || remoteState === "avvio" ? "spegni fuori-casa" : "attiva fuori-casa"}
            </button>
          </div>
          {!phoneUrl && <div id="phone-note">accendi prima il collegamento telefono qui sopra.</div>}
          {phoneUrl && remoteState !== "off" && remoteState !== "" && remoteState !== "pronto" && (
            <div id="phone-note">fuori-casa: {remoteState}...</div>
          )}
          {remoteUrl && (
            <div id="phone-qr">
              <div id="phone-qr-img">
                {qrOk && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(remoteUrl)}`}
                    alt="QR fuori-casa"
                    onError={() => setQrOk(false)}
                  />
                )}
              </div>
              <div id="phone-url">{remoteUrl}</div>
              <button className="chan" onClick={() => copyPhone(remoteUrl)}>copia link</button>
              <div id="phone-note">vale su qualsiasi rete · il link cambia a ogni accensione · non condividerlo</div>
            </div>
          )}

          {msg && <div id="task-msg">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
