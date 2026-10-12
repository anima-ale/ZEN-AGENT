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
    // Run live: conferme numerate in oro, riga di inizio in grigio
    if (line.startsWith('OK "')) {
      closeList();
      html += `<div class="md-ok">${mdInline(line)}</div>`;
      continue;
    }
    if (line.startsWith("▶ ")) {
      closeList();
      html += `<div class="md-start">${mdInline(line)}</div>`;
      continue;
    }
    // Riepilogo finale: una riga sobria
    if (line.startsWith("✓ ")) {
      closeList();
      html += `<div class="md-done">${mdInline(line)}</div>`;
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
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  trash: "M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M10 11v6 M14 11v6",
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
  const [files, setFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // id del messaggio agente in volo: qui si accumulano inizio + OK live
  const liveId = useRef<number | null>(null);
  // handler telefono sempre fresco per i listener registrati una volta sola
  const runPhoneRef = useRef<(pid: number, text: string) => Promise<void>>(async () => undefined);
  // Chiuso nella goccia mentre ZEN Nebula pensava: alla risposta suona la notifica
  const hiddenWhileBusy = useRef(false);
  // Specchio sincrono di busy per i callback (coda telefono)
  const busyRef = useRef(false);
  // Messaggio dal telefono arrivato mentre ZEN era occupato: parte dopo
  const pendingPhone = useRef<{ pid: number; text: string } | null>(null);

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
      // Run live dal motore: inizio, OK per attività, pensieri in grigio
      if (!alive) return;
      const appendLive = (line: string) => {
        if (!alive || liveId.current == null) return;
        const id = liveId.current;
        setMessages((m) =>
          m.map((msg) => (msg.id === id ? { ...msg, text: msg.text ? `${msg.text}\n${line}` : line } : msg)),
        );
      };
      unlistens.push(await listen<string>("zen-run-started", (e) => appendLive(e.payload)));
      if (!alive) return;
      unlistens.push(await listen<string>("zen-run-progress", (e) => appendLive(e.payload)));
      if (!alive) return;
      unlistens.push(
        await listen<string>("zen-thinking", (e) => {
          if (alive) setThinking(e.payload);
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen<{ id: number; text: string }>("zen-phone-message", (e) => {
          if (alive) runPhoneRef.current(e.payload.id, e.payload.text);
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
  }, [messages, busy]);

  // Nucleo invio: crea il messaggio agente live e ritorna la risposta finale.
  // Usato sia dal composer sia dai messaggi arrivati dal telefono.
  const runAgent = async (promptText: string, attached: string[]): Promise<string> => {
    const id = nextId++;
    liveId.current = id;
    setThinking(null);
    setMessages((m) => [...m, { id, who: "agent", text: "" }]);
    try {
      const out = await api.run(promptText, auto, attached);
      const finalText = out || "(nessun output)";
      setMessages((m) =>
        m.map((msg) => {
          if (msg.id !== id) return msg;
          // A lavoro finito le righe live spariscono: resta una riga
          // di riepilogo + la risposta pulita, niente passaggi.
          const lines = msg.text.split("\n");
          const nActs = lines.filter((l) => l.startsWith('OK "')).length;
          const kept = lines.filter((l) => {
            const t = l.trim();
            return t !== "" && !t.startsWith("▶ ") && !t.startsWith('OK "');
          });
          const head = nActs > 0 ? [`✓ fatto (${nActs} attività)`] : [];
          return { ...msg, text: [...kept, ...head, finalText].join("\n") };
        }),
      );
      return finalText;
    } catch (e) {
      const err = String(e);
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, text: "Errore: " + err } : msg)));
      if (err.includes("no session table")) setNeedsRepair(true);
      return "Errore: " + err;
    } finally {
      // risposta arrivata: pensieri in grigio spariscono, resta inizio + OK + risposta
      liveId.current = null;
      setThinking(null);
    }
  };

  const send = async () => {
    const text = prompt.trim();
    if (!text || busyRef.current) return;
    setPrompt("");
    busyRef.current = true;
    setBusy(true);
    const attached = [...files];
    setFiles([]);
    push("user", attached.length ? `${text}\n[allegati: ${attached.map(fileName).join(", ")}]` : text);
    await runAgent(text, attached);
    // risposta arrivata: se eri chiuso nella goccia, notifica con suono + pallino
    busyRef.current = false;
    setBusy(false);
    setBusySecs(0);
    api.hideGame().catch(() => undefined);
    if (hiddenWhileBusy.current) {
      hiddenWhileBusy.current = false;
      api.notifyReady().catch(() => undefined);
    }
    drainPhone();
  };

  // Fa partire il messaggio in coda (se libero), dopo ogni run.
  const drainPhone = () => {
    const p = pendingPhone.current;
    if (!p || busyRef.current) return;
    pendingPhone.current = null;
    runPhone(p.pid, p.text);
  };

  // Messaggi dal telefono (QR): entrano nella sessione aperta come i tuoi.
  const runPhone = async (pid: number, text: string) => {
    if (busyRef.current) {
      pendingPhone.current = { pid, text };
      push("system", "telefono: ZEN è occupato, messaggio in coda.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    push("user", `telefono: ${text}`);
    const ans = await runAgent(text, []);
    busyRef.current = false;
    setBusy(false);
    setBusySecs(0);
    api.phoneAnswer(pid, ans).catch(() => undefined);
    if (hiddenWhileBusy.current) {
      hiddenWhileBusy.current = false;
      api.notifyReady().catch(() => undefined);
    }
    drainPhone();
  };
  runPhoneRef.current = runPhone;

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

  // Trattino: la finestra risale contro la parete superiore e diventa il rettangolino ZEN
  const minimizeUp = async () => {
    if (closing) return;
    if (busy) hiddenWhileBusy.current = true;
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
          <button className="icon-btn" title="Impostazioni" onClick={() => api.showSettings().catch(() => undefined)}>
            <Icon d={P.gear} />
          </button>
          <button className="icon-btn" title="Elimina definitivamente la chat" onClick={clearHistory}>
            <Icon d={P.trash} />
          </button>
          <button className="icon-btn" title="Riduci nel rettangolino ZEN" onClick={minimizeUp}>
            <Icon d={P.minus} />
          </button>
        </div>

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
                dangerouslySetInnerHTML={{ __html: m.text ? renderMarkdown(m.text) : "<div class=\"md-p\">…</div>" }}
              />
            ) : (
              <div key={m.id} className={`msg ${m.who}`}>{m.text}</div>
            ),
          )}
        </div>

        {busy && (
          <div id="think-bar">
            <ThinkOrb />
            {thinking ? (
              <span id="think-thoughts">{thinking}</span>
            ) : (
              <span id="think-text">ZEN Nebula pensa<span className="gold-dots"><span>.</span><span>.</span><span>.</span></span></span>
            )}
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
                <button id="tasks-btn" title="Attività programmate" onClick={() => api.showTasks().catch(() => undefined)}>
                  <Icon d={P.clock} />
                  <span>attività programmate</span>
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
