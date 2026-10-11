import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  api,
  fileName,
  isImage,
  onExpectFiles,
  onFilesDropped,
  type AgentStatus,
  type UpdateInfo,
  type UpdateProgress,
} from "../api";

interface Msg {
  id: number;
  who: "user" | "agent" | "system";
  text: string;
}

let nextId = 1;
const HIST_KEY = "zen-agent-history-v1";
const HIST_MAX = 100;

// ---------- mini-markdown NEO1 (niente dipendenze, solo cornice vestita) ----------
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdInline(s: string): string {
  // escape già fatto dal chiamante per il testo, qui solo tag
  let out = s;
  out = out.replace(/`([^`\n]+)`/g, "<code class=\"md-code\">$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, "$1<i>$2</i>");
  out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noreferrer\">$1</a>");
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = esc(src).split("\n");
  let html = "";
  let inCode = false;
  let codeBuf: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html += `<div class="code-block"><div class="code-header">codice</div><pre><code>${codeBuf.join("\n")}</code></pre></div>`;
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      html += `<div class="md-h${lvl}">${mdInline(h[2])}</div>`;
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        html += "<ul class=\"md-ul\">";
        inList = true;
      }
      html += `<li>${mdInline(li[1])}</li>`;
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      closeList();
      html += `<div class="md-li">• ${mdInline(ol[1])}</div>`;
      continue;
    }
    if (line.trim() === "") {
      closeList();
      html += "<div class=\"md-gap\"></div>";
      continue;
    }
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      closeList();
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{1,}:?$/.test(c) || c === "")) continue;
      html += `<div class="md-tr">${cells.map((c) => `<span class="md-td">${mdInline(c)}</span>`).join("")}</div>`;
      continue;
    }
    closeList();
    html += `<div class="md-p">${mdInline(line)}</div>`;
  }
  closeList();
  if (inCode) {
    html += `<div class="code-block"><pre><code>${codeBuf.join("\n")}</code></pre></div>`;
  }
  return html;
}

interface DragPayload {
  paths: string[];
  position: { x: number; y: number };
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const P = {
  refresh: "M21 12a9 9 0 1 1-2.64-6.36 M21 3v6h-6",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  minus: "M5 12h14",
  clip: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  x: "M18 6L6 18 M6 6l12 12",
};

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Msg[];
    if (!Array.isArray(arr)) return [];
    nextId = arr.reduce((m, x) => Math.max(m, x.id + 1), 1);
    return arr.slice(-HIST_MAX);
  } catch {
    return [];
  }
}

// Orb di pensiero NEO1: scelta "orb" senza librerie esterne (offline-first).
// Guida §6: loading = testo mono + puntini oro; orb solo in scala di grigi,
// spinner #333 con cima #888, niente gradienti colorati, niente pulse.
function ThinkOrb() {
  return (
    <span className="think-orb" aria-hidden="true">
      <span className="think-orb-ring" />
      <span className="think-orb-core" />
    </span>
  );
}

export default function PanelApp() {
  const [messages, setMessages] = useState<Msg[]>(() => {
    const h = loadHistory();
    if (h.length > 0) return h;
    return [
      {
        id: 0,
        who: "system",
        text: "ZEN-AGENT pronto con ZEN Nebula. Chiedi pure: pianifico e agisco da solo, anche a finestra chiusa. Trascina file qui o sulla fascia in alto per allegarli.",
      },
    ];
  });
  const [prompt, setPrompt] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busySecs, setBusySecs] = useState(0);
  const [thoughts, setThoughts] = useState<string>("");
  const [files, setFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [channel, setChannelState] = useState("stable");
  const [showSettings, setShowSettings] = useState(false);
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // persistenza storia
  useEffect(() => {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(messages.slice(-HIST_MAX)));
    } catch {
      /* quota piena: ignora */
    }
  }, [messages]);

  // contatore secondi di pensiero (per bottone snake a 20s)
  useEffect(() => {
    if (!busy) {
      setBusySecs(0);
      return;
    }
    setBusySecs(0);
    const t = window.setInterval(() => setBusySecs((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  const push = useCallback((who: Msg["who"], text: string) => {
    setMessages((m) => [...m, { id: nextId++, who, text }]);
  }, []);

  const historyForBackend = useCallback((): string[] => {
    // ultime 12 voci utente/agent come "utente: ..."/"zen: ..."
    return messages
      .filter((m) => m.who !== "system")
      .slice(-12)
      .map((m) => (m.who === "user" ? `utente: ${m.text}` : `zen: ${m.text}`));
  }, [messages]);

  const addFiles = useCallback(
    (paths: string[]) => {
      const fresh = paths.filter((p) => p && !files.includes(p));
      if (fresh.length === 0) return;
      setFiles((f) => [...f, ...fresh]);
      push(
        "system",
        fresh.length === 1
          ? `allegato: ${fileName(fresh[0])} (inviato con la prossima domanda)`
          : `${fresh.length} file allegati (inviati con la prossima domanda)`,
      );
    },
    [files, push],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
    } catch {
      /* riprovo al prossimo giro */
    }
  }, []);

  const checkForUpdates = useCallback(
    async (silent: boolean) => {
      setChecking(true);
      try {
        const info = await api.checkUpdate();
        setChannelState(info.channel);
        if (info.available) {
          setUpdate(info);
          if (!silent) push("system", `aggiornamento disponibile: v${info.latest} (canale ${info.channel})`);
        } else if (info.message === "no-release") {
          setUpdate(null);
          if (!silent) push("system", `nessuna release pubblicata sul canale ${info.channel}: crea il repo e lancia pubblica-update.bat`);
        } else if (!silent) {
          push("system", `nessun aggiornamento (v${info.current}, canale ${info.channel})`);
        }
      } catch (e) {
        if (!silent) push("system", "controllo aggiornamenti fallito: " + String(e));
      } finally {
        setChecking(false);
      }
    },
    [push],
  );

  useEffect(() => {
    api.ensureSetup().then(() => refreshStatus()).catch(() => refreshStatus());
    refreshStatus();
    const t = window.setInterval(refreshStatus, 8000);
    checkForUpdates(true);

    let alive = true;
    const unlistens: Array<() => void> = [];
    (async () => {
      unlistens.push(await onFilesDropped((paths) => alive && addFiles(paths)));
      if (!alive) return;
      unlistens.push(await onExpectFiles(() => alive && setDragOver(true)));
      if (!alive) return;
      unlistens.push(
        await listen<DragPayload>("tauri://drag-enter", (e) => {
          if (alive && e.payload.paths?.length) setDragOver(true);
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen<DragPayload>("tauri://drag-drop", (e) => {
          if (!alive) return;
          setDragOver(false);
          if (e.payload.paths?.length) addFiles(e.payload.paths);
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen("tauri://drag-leave", () => {
          if (!alive) return;
          window.setTimeout(() => alive && setDragOver(false), 300);
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen<UpdateInfo>("zen-update-available", (e) => {
          if (alive) setUpdate(e.payload);
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen<UpdateProgress>("zen-update-progress", (e) => {
          if (alive) setProgress(e.payload);
        }),
      );
    })();
    return () => {
      alive = false;
      window.clearInterval(t);
      unlistens.forEach((u) => u());
    };
  }, [refreshStatus, checkForUpdates, addFiles]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thoughts, busy]);

  const send = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setPrompt("");
    setBusy(true);
    setThoughts("pianifico i passi...");
    const attached = [...files];
    setFiles([]);
    const hist = historyForBackend();
    push("user", attached.length ? `${text}\n[allegati: ${attached.map(fileName).join(", ")}]` : text);
    const id = nextId++;
    setMessages((m) => [...m, { id, who: "agent", text: "..." }]);
    // Piano reale in background: i pensieri veri escono accanto all'orb
    api.plan(text, [...hist, `utente: ${text}`]).then(
      (p) => {
        const clean = (p || "").trim();
        if (clean) setThoughts(clean.slice(0, 800));
      },
      () => {},
    );
    try {
      const out = await api.run(text, auto, attached, [...hist, `utente: ${text}`]);
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, text: out || "(nessun output)" } : msg)));
    } catch (e) {
      const err = String(e);
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, text: "Errore: " + err } : msg)));
      if (err.includes("no session table")) setNeedsRepair(true);
    } finally {
      // risposta arrivata: pensieri + bottone + finestra snake scompaiono
      setBusy(false);
      setThoughts("");
      setBusySecs(0);
      api.hideGame().catch(() => undefined);
    }
  };

  const doRepair = async () => {
    setRepairing(true);
    try {
      const res = await invoke<string>("repair_opencode_db");
      push("system", res + " Riprova la domanda tra qualche secondo.");
      setNeedsRepair(false);
      refreshStatus();
    } catch (e) {
      push("system", "riparazione fallita: " + String(e));
    } finally {
      setRepairing(false);
    }
  };

  const browse = async () => {
    try {
      const sel = await openDialog({
        multiple: true,
        filters: [
          { name: "Immagini", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] },
          { name: "Tutti i file", extensions: ["*"] },
        ],
      });
      if (!sel) return;
      addFiles(Array.isArray(sel) ? sel : [sel]);
    } catch (e) {
      push("system", "selezione file fallita: " + String(e));
    }
  };

  const doInstallUpdate = async () => {
    if (!update) return;
    try {
      setProgress({ received: 0, total: 1 });
      push("system", `scarico v${update.latest}: ZEN-AGENT si chiudera e si riaprira aggiornato.`);
      await api.installUpdate(update);
    } catch (e) {
      setProgress(null);
      push("system", "aggiornamento fallito: " + String(e));
    }
  };

  const changeChannel = async (c: string) => {
    try {
      await api.setChannel(c);
      setChannelState(c);
      setUpdate(null);
      checkForUpdates(true);
    } catch (e) {
      push("system", "cambio canale fallito: " + String(e));
    }
  };

  // Trattino: la finestra risale contro la parete superiore e diventa il rettangolino ZEN
  const minimizeUp = async () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      api.minimizeToDrop().catch(() => api.hidePanel().catch(() => undefined));
      window.setTimeout(() => setClosing(false), 600);
    }, 240);
  };

  const clearHistory = () => {
    setMessages([
      { id: nextId++, who: "system", text: "Storia pulita. ZEN Nebula resta pronto." },
    ]);
    try {
      localStorage.removeItem(HIST_KEY);
    } catch {
      /* ignora */
    }
  };

  const dotClass = !status ? "" : status.opencode && status.serve ? "ok" : status.opencode ? "" : "err";
  const statusText = checking
    ? "controllo aggiornamenti..."
    : !status
      ? "avvio..."
      : status.opencode
        ? `ZEN Nebula ${status.version} - ${status.serve ? "attivo" : "in avvio..."}`
        : "ZEN Nebula non trovato - installazione automatica...";

  return (
    <div id="panel-root">
      <div id="panel" className={closing ? "panel-closing" : ""}>
        <div id="panel-header">
          <div className="orb">Z</div>
          <div className="titles">
            <b>ZEN-AGENT</b>
            <span>{status ? `ZEN Nebula - ${status.model || "motore pronto"}` : "avvio motore..."}</span>
          </div>
          <button className="icon-btn" title="Cerca aggiornamenti" onClick={() => checkForUpdates(false)} disabled={checking}>
            <Icon d={P.refresh} />
          </button>
          <button className="icon-btn" title="Impostazioni" onClick={() => setShowSettings((s) => !s)}>
            <Icon d={P.gear} />
          </button>
          <button className="icon-btn" title="Riduci nel rettangolino ZEN" onClick={minimizeUp}>
            <Icon d={P.minus} />
          </button>
        </div>

        {showSettings && (
          <div id="settings-bar">
            <span>CANALE</span>
            {(["stable", "beta", "alpha"] as const).map((c) => (
              <button key={c} className={`chan ${channel === c ? "on" : ""}`} onClick={() => changeChannel(c)}>
                {c}
              </button>
            ))}
            <button className="chan" title="Pulisci storia chat" onClick={clearHistory}>
              pulisci
            </button>
            <span id="cwd-label" title={status?.cwd ?? ""}>{status?.cwd ?? "..."}</span>
          </div>
        )}

        <div id="status-bar">
          <span id="status-dot" className={dotClass} />
          <span id="status-text">{statusText}</span>
        </div>

        {needsRepair && (
          <div id="repair-bar">
            <div className="repair-title">Database ZEN Nebula da riparare</div>
            <div className="repair-sub">Chiude temporaneamente il motore, sposta il DB corrotto in backup e riavvia.</div>
            <button id="repair-go" onClick={doRepair} disabled={repairing}>
              {repairing ? "riparo..." : "ripara ora"}
            </button>
          </div>
        )}

        {update?.available && (
          <div id="update-bar">
            <div className="update-title">Nuova versione v{update.latest} ({update.channel})</div>
            <div className="update-notes">{update.notes || "Migliorie e correzioni."}</div>
            {progress ? (
              <div className="update-prog">
                <div
                  className="update-prog-fill"
                  style={{ width: `${progress.total ? Math.round((progress.received / progress.total) * 100) : 0}%` }}
                />
              </div>
            ) : (
              <button id="update-go" onClick={doInstallUpdate}>scarica e installa</button>
            )}
          </div>
        )}

        <div id="messages" ref={scrollRef}>
          {messages.map((m) =>
            m.who === "agent" ? (
              <div
                key={m.id}
                className="msg agent md"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
              />
            ) : (
              <div key={m.id} className={`msg ${m.who}`}>{m.text}</div>
            ),
          )}
        </div>

        {busy && (
          <div id="think-bar">
            <ThinkOrb />
            <span id="think-text">ZEN Nebula pensa<span className="gold-dots"><span>.</span><span>.</span><span>.</span></span></span>
            {thoughts && <span id="think-thoughts" title="Pensieri di ZEN Nebula">{thoughts}</span>}
            {busySecs >= 20 && (
              <button
                id="snake-btn"
                title="Apri Snake mentre aspetti"
                onClick={() => api.showGame().catch(() => undefined)}
              >
                gioca a snake
              </button>
            )}
          </div>
        )}

        {files.length > 0 && (
          <div id="attach-bar">
            {files.map((f) => (
              <div key={f} className="attach-chip" title={f}>
                {isImage(f) ? (
                  <img src={convertFileSrc(f)} alt={fileName(f)} />
                ) : (
                  <span className="file-ico">F</span>
                )}
                <span className="attach-name">{fileName(f)}</span>
                <button onClick={() => setFiles((arr) => arr.filter((x) => x !== f))}>
                  <Icon d={P.x} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div id="composer">
          <div className="unified-input-wrapper">
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Chiedi a ZEN Nebula di fare cose sul tuo PC... (Invio = invia)"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
                if (e.key === "Escape") minimizeUp();
              }}
            />
            <div className="nib-controls">
              <div className="nib-left">
                <button id="attachment-btn" title="Allega file" onClick={browse}>
                  <Icon d={P.clip} />
                </button>
                <label id="auto-label">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> auto
                </label>
              </div>
              <button id="send" title="Invia" disabled={busy} onClick={send}>
                <Icon d={P.send} />
              </button>
            </div>
          </div>
        </div>

        {dragOver && (
          <div id="drop-overlay">
            <div className="drop-overlay-card">
              <div className="drop-overlay-title">Rilascia per allegare</div>
              <div className="drop-overlay-sub">IL FILE VERRA ALLEGATO ALLA PROSSIMA DOMANDA</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
