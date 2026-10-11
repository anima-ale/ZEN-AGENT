import { useCallback, useEffect, useState } from "react";
import { api, type AgentTask } from "../api";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const P = {
  minus: "M5 12h14",
  x: "M18 6L6 18 M6 6l12 12",
};

function fmtInterval(s: number): string {
  if (s % 3600 === 0) return `ogni ${s / 3600}h`;
  if (s % 60 === 0) return `ogni ${s / 60} min`;
  return `ogni ${s}s`;
}

function when(t: AgentTask): string {
  if (t.time_daily) return `ogni giorno alle ${t.time_daily}`;
  return fmtInterval(t.interval_secs);
}

export default function TasksApp() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"interval" | "daily">("interval");
  const [every, setEvery] = useState("60");
  const [unit, setUnit] = useState<"min" | "h">("min");
  const [at, setAt] = useState("08:00");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTasks(await api.listTasks());
    } catch {
      /* riprovo al prossimo giro */
    }
  }, []);

  useEffect(() => {
    reload();
    const t = window.setInterval(reload, 5000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") api.hideTasks().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [reload]);

  const add = async () => {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (mode === "daily") {
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(at.trim())) {
          setMsg("orario non valido (usa HH:MM, es. 08:30)");
          return;
        }
        await api.addTask(p, 3600, at.trim());
        setMsg(`programmata ogni giorno alle ${at.trim()}`);
      } else {
        const n = Math.max(1, parseInt(every, 10) || 60);
        const secs = unit === "h" ? n * 3600 : n * 60;
        await api.addTask(p, secs, null);
        setMsg(`programmata ${fmtInterval(secs)}`);
      }
      setPrompt("");
      reload();
    } catch (e) {
      setMsg("errore: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    try {
      await api.removeTask(id);
      reload();
    } catch (e) {
      setMsg("eliminazione fallita: " + String(e));
    }
  };

  return (
    <div id="aux-root">
      <div id="aux-card">
        <div id="aux-header">
          <span id="aux-title">ATTIVITÀ PROGRAMMATE</span>
          <button className="icon-btn" title="Chiudi" onClick={() => api.hideTasks().catch(() => undefined)}>
            <Icon d={P.minus} />
          </button>
        </div>

        <div id="aux-body">
          <div className="aux-label">NUOVA ATTIVITÀ</div>
          <textarea
            id="task-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Cosa deve fare ZEN da sola? (es. ogni mattina apri Chrome col meteo)"
          />
          <div id="task-mode">
            <button className={`chan ${mode === "interval" ? "on" : ""}`} onClick={() => setMode("interval")}>
              ogni
            </button>
            <button className={`chan ${mode === "daily" ? "on" : ""}`} onClick={() => setMode("daily")}>
              alle ore
            </button>
            {mode === "interval" ? (
              <span id="task-when">
                <input
                  id="task-every"
                  type="number"
                  min={1}
                  value={every}
                  onChange={(e) => setEvery(e.target.value)}
                />
                <button className={`chan ${unit === "min" ? "on" : ""}`} onClick={() => setUnit("min")}>min</button>
                <button className={`chan ${unit === "h" ? "on" : ""}`} onClick={() => setUnit("h")}>ore</button>
              </span>
            ) : (
              <input id="task-at" type="time" value={at} onChange={(e) => setAt(e.target.value)} />
            )}
          </div>
          <button id="task-add" onClick={add} disabled={busy || !prompt.trim()}>
            {busy ? "salvo..." : "programma"}
          </button>
          {msg && <div id="task-msg">{msg}</div>}

          <div className="aux-label">ATTIVE ({tasks.length})</div>
          <div id="task-list">
            {tasks.length === 0 && <div id="task-empty">nessuna: ZEN riposa.</div>}
            {tasks.map((t) => (
              <div key={t.id} className="task-row" title={t.prompt}>
                <div className="task-info">
                  <div className="task-when">{when(t)}</div>
                  <div className="task-prompt">{t.prompt}</div>
                </div>
                <button className="icon-btn" title="Elimina" onClick={() => del(t.id)}>
                  <Icon d={P.x} />
                </button>
              </div>
            ))}
          </div>
          <div id="task-hint">GIRANO ANCHE A FINESTRA CHIUSA, VIA MOTORE SEMPRE ATTIVO.</div>
        </div>
      </div>
    </div>
  );
}
