import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, notifyPanelExpectFiles, notifyPanelFiles } from "../api";

interface DragPayload {
  paths: string[];
  position: { x: number; y: number };
}

export default function DropApp() {
  const [visible, setVisible] = useState(false);
  const [dragFiles, setDragFiles] = useState(false);
  const [pull, setPull] = useState(0);
  const dragState = useRef({ dragging: false, startY: 0, opened: false });
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
  const hideDelayed = useCallback(() => {
    if (dragState.current.dragging) return;
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      hide();
    }, 600);
  }, [cancelHide, hide]);

  const openPanel = useCallback(async () => {
    dragState.current.opened = true;
    setPull(0);
    setVisible(false);
    setDragFiles(false);
    api.setDropPinned(false).catch(() => undefined);
    api.setDropDragging(false).catch(() => undefined);
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
    (async () => {
      unlistens.push(await listen<boolean>("zen-drop-state", (e) => {
        if (!alive) return;
        if (e.payload) show();
        else {
          setVisible(false);
          setDragFiles(false);
        }
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
  }, [show, hide]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { dragging: true, startY: e.clientY, opened: false };
    api.setDropDragging(true).catch(() => undefined);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    if (dy > 0) setPull(Math.min(dy, 160));
    if (dy > 70 && !dragState.current.opened) openPanel();
  };
  const endDrag = (e: React.PointerEvent, clicked: boolean) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    dragState.current.dragging = false;
    api.setDropDragging(false).catch(() => undefined);
    if (clicked && dy <= 70 && dy > -10 && !dragState.current.opened) openPanel();
    else {
      setPull(0);
      hide();
    }
  };

  return (
    <div id="drop-root">
      <div id="drop-zone">
        <div
          id="drop"
          className={`${visible ? "visible" : ""} ${dragFiles ? "attach" : ""}`}
          style={pull > 0 ? { transform: `translateY(${pull}px)` } : undefined}
          onMouseEnter={show}
          onMouseLeave={hideDelayed}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
        >
          <span className="dot" />
          <span className="label">{dragFiles ? "RILASCIA PER ALLEGARE" : "ZEN"}</span>
        </div>
      </div>
      <div id="drop-hint" className={visible ? "visible" : ""}>
        {dragFiles
          ? "Rilascia il file: si allega alla tua domanda"
          : "Trascina giu per aprire ZEN-AGENT"}
      </div>
    </div>
  );
}
