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
  const [msg, setMsg] = useState("");

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
  }, []);

  useEffect(() => {
    reload();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api.hideSettings().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reload]);

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

          {msg && <div id="task-msg">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
