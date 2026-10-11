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
  const hideTimer = useRef<number | undefined>(undefined);
  const dragState = useRef({ dragging: false, startY: 0, opened: false });

  const show = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!dragState.current.dragging) {
        setVisible(false);
        setDragFiles(false);
      }
    }, 3500);
  }, []);

  const hide = useCallback(() => {
    if (dragState.current.dragging) return;
    setVisible(false);
    setDragFiles(false);
  }, []);

  const openPanel = useCallback(async () => {
    dragState.current.opened = true;
    setPull(0);
    setVisible(false);
    setDragFiles(false);
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
    const onMove = (e: MouseEvent) => {
      if (e.clientY <= 2) show();
    };
    window.addEventListener("mousemove", onMove);

    // Trascini un file in alto al display -> apri Zen e preparalo all'allegato
    const unlistens: Array<() => void> = [];
    let alive = true;
    (async () => {
      unlistens.push(
        await listen<DragPayload>("tauri://drag-enter", async (e) => {
          if (!alive) return;
          if (e.payload.paths && e.payload.paths.length > 0) {
            setDragFiles(true);
            setVisible(true);
            window.clearTimeout(hideTimer.current);
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
            // Rilasciato proprio sulla fascia alta: inoltra al pannello
            try {
              await api.showPanel();
              await notifyPanelFiles(e.payload.paths);
            } catch (err) {
              console.error(err);
            }
            setDragFiles(false);
            setVisible(false);
          }
        }),
      );
      if (!alive) return;
      unlistens.push(
        await listen("tauri://drag-leave", () => {
          if (!alive) return;
          window.setTimeout(() => {
            setDragFiles(false);
            hide();
          }, 400);
        }),
      );
    })();
    return () => {
      alive = false;
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(hideTimer.current);
      unlistens.forEach((u) => u());
    };
  }, [show, hide]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { dragging: true, startY: e.clientY, opened: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    if (dy > 0) setPull(Math.min(dy, 160));
    if (dy > 70 && !dragState.current.opened) openPanel();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dy = e.clientY - dragState.current.startY;
    dragState.current.dragging = false;
    if (dy <= 70 && dy > -10 && !dragState.current.opened) openPanel();
    else {
      setPull(0);
      hide();
    }
  };

  return (
    <div id="drop-root">
      <div id="sensor" title="Zen Agent" onMouseEnter={show} />
      <div id="drop-zone">
        <div
          id="drop"
          className={`${visible ? "visible" : ""} ${dragFiles ? "attach" : ""}`}
          style={pull > 0 ? { transform: `translateY(${pull}px) scale(1)` } : undefined}
          onMouseEnter={show}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="dot" />
          <span className="label">{dragFiles ? "RILASCIA PER ALLEGARE" : "ZEN"}</span>
        </div>
      </div>
      <div id="drop-hint" className={visible ? "visible" : ""}>
        {dragFiles
          ? "Rilascia il file: si allega alla tua domanda"
          : "Trascina giu per aprire Zen Agent"}
      </div>
    </div>
  );
}
