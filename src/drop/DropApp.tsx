import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, notifyPanelExpectFiles, notifyPanelFiles } from "../api";

interface DragPayload {
  paths: string[];
  position: { x: number; y: number };
}

// Suoni di notifica sintetizzati via WebAudio (nessun file, NEO1 pulito).
function playNotify(kind: string) {
  if (!kind || kind === "off") return;
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

export default function DropApp() {
  const [visible, setVisible] = useState(false);
  const [dragFiles, setDragFiles] = useState(false);
  const [pull, setPull] = useState<[number, number]>([0, 0]);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState("top");
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, opened: false });
  const hideTimer = useRef<number | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    // Hover transiente: NON pinna, così quando il mouse si allontana
    // per davvero il tracker backend nasconde la finestrella.
    cancelHide();
    setVisible(true);
  }, [cancelHide]);

  const hide = useCallback(() => {
    if (dragState.current.dragging) return;
    setVisible(false);
    setDragFiles(false);
    api.setDropPinned(false).catch(() => undefined);
  }, []);

  // Hide con grazia: sul mouse-leave aspetta 600ms (cancellato al rientro),
  // così la pill non sparisce dopo pochissimi pixel mentre la si raggiunge.
  // Mai durante una notifica di risposta: resta finché non la apri.
  const hideDelayed = useCallback(() => {
    if (dragState.current.dragging) return;
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setReady((r) => {
        if (!r) hide();
        return r;
      });
    }, 600);
  }, [cancelHide, hide]);

  const openPanel = useCallback(async () => {
    dragState.current.opened = true;
    setPull([0, 0]);
    setVisible(false);
    setDragFiles(false);
    setReady(false);
    api.setDropPinned(false).catch(() => undefined);
    api.setDropDragging(false).catch(() => undefined);
    api.clearReady().catch(() => undefined);
    try {
      await api.showPanel();
    } catch (e) {
      console.error(e);
    }
    window.setTimeout(() => {
      dragState.current.opened = false;
    }, 800);
  }, []);

  useEffect(() => {
    // Il backend mostra/nasconde la finestrella seguendo il cursore:
    // qui sincronizziamo solo la pill per l'animazione.
    let alive = true;
    const unlistens: Array<() => void> = [];
    api.getDropPosition().then((p) => alive && p && setPos(p)).catch(() => undefined);
    (async () => {
      unlistens.push(await listen<string>("zen-drop-position", (e) => {
        if (alive && e.payload) setPos(e.payload);
      }));
      if (!alive) return;
      unlistens.push(await listen<boolean>("zen-drop-state", (e) => {
        if (!alive) return;
        if (e.payload) show();
        else {
          setVisible(false);
          setDragFiles(false);
        }
      }));
      if (!alive) return;
      // Risposta pronta mentre il pannello era chiuso: la barra scende
      // col pallino rosso + suono scelto nelle impostazioni.
      unlistens.push(await listen<string>("zen-response-ready", (e) => {
        if (!alive) return;
        cancelHide();
        setReady(true);
        setVisible(true);
        api.setDropPinned(true).catch(() => undefined);
        playNotify(e.payload || "ding");
      }));
      if (!alive) return;
      // Pannello riaperto: il pallino rosso scompare.
      unlistens.push(await listen("zen-response-cleared", () => {
        if (!alive) return;
        setReady(false);
      }));
      if (!alive) return;
      unlistens.push(
        await listen<DragPayload>("tauri://drag-enter", async (e) => {
          if (!alive) return;
          if (e.payload.paths && e.payload.paths.length > 0) {
            setDragFiles(true);
            // Solo durante un vero trascinamento file pinniamo la goccia
            api.setDropPinned(true).catch(() => undefined);
            show();
            try {
              await api.showPanel();
            } catch (err) {
              console.error(err);
            }
            try {
              await notifyPanelExpectFiles();
            } catch (err) {
              console.error(err);
            }
          }
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen<DragPayload>("tauri://drag-drop", async (e) => {
          if (!alive) return;
          if (e.payload.paths && e.payload.paths.length > 0) {
            try {
              await api.showPanel();
              await notifyPanelFiles(e.payload.paths);
            } catch (err) {
              console.error(err);
            }
            setDragFiles(false);
            hide();
          }
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen("tauri://drag-leave", () => {
          if (!alive) return;
          window.setTimeout(() => hide(), 400);
        }),
      );
    })();
    return () => {
      alive = false;
      unlistens.forEach((u) => u());
    };
  }, [show, hide, cancelHide]);

  // Gesto verso il centro dello schermo, secondo il bordo assegnato a ZEN
  const toward = useCallback((e: React.PointerEvent) => {
    if (pos === "left") return e.clientX - dragState.current.startX;
    if (pos === "right") return dragState.current.startX - e.clientX;
    if (pos === "bottom") return dragState.current.startY - e.clientY;
    return e.clientY - dragState.current.startY;
  }, [pos]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, opened: false };
    api.setDropDragging(true).catch(() => undefined);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const d = toward(e);
    if (d > 0) {
      const v = Math.min(d, 160);
      setPull(pos === "left" || pos === "right" ? [v, 0] : [0, v]);
    }
    if (d > 70 && !dragState.current.opened) openPanel();
  };
  const endDrag = (e: React.PointerEvent, clicked: boolean) => {
    if (!dragState.current.dragging) return;
    const d = toward(e);
    dragState.current.dragging = false;
    api.setDropDragging(false).catch(() => undefined);
    if (clicked && d <= 70 && d > -10 && !dragState.current.opened) openPanel();
    else {
      setPull([0, 0]);
      hide();
    }
  };

  const hint =
    dragFiles
      ? "Rilascia il file: si allega alla tua domanda"
      : ready
        ? "ZEN Nebula ti ha risposto: apri per leggere"
        : pos === "bottom"
          ? "Trascina su per aprire ZEN-AGENT"
          : pos === "left"
            ? "Trascina a destra per aprire ZEN-AGENT"
            : pos === "right"
              ? "Trascina a sinistra per aprire ZEN-AGENT"
              : "Trascina giu per aprire ZEN-AGENT";

  return (
    <div id="drop-root">
      <div id="drop-zone">
        <div
          id="drop"
          className={`${visible ? "visible" : ""} ${dragFiles ? "attach" : ""} ${ready ? "notify" : ""}`}
          style={pull[0] || pull[1] ? { transform: `translate(${pull[0]}px, ${pull[1]}px)` } : undefined}
          onMouseEnter={show}
          onMouseLeave={hideDelayed}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
        >
          <span className="dot" />
          <span className="label">{dragFiles ? "RILASCIA PER ALLEGARE" : ready ? "RISPOSTA PRONTA" : "ZEN"}</span>
          {ready && <span className="red-dot" />}
        </div>
      </div>
      <div id="drop-hint" className={visible ? "visible" : ""}>
        {hint}
      </div>
    </div>
  );
}
