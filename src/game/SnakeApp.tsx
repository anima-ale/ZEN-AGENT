import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

// Snake NEO1: piatto, monocromo, appuntito, istantaneo.
// Palette guida §2: bg #0a0a09, card #141414, bordi #2a2a2a, testi #f0f0f0/#9a9a9a,
// oro #e8b04b solo per cibo + bottone primario. Niente blur, niente glow.
const COLS = 18;
const ROWS = 22;
const CELL = 16;
const W = COLS * CELL;
const H = ROWS * CELL;

type Pt = { x: number; y: number };

function rndFree(snake: Pt[]): Pt {
  for (;;) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

export default function SnakeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snake, setSnake] = useState<Pt[]>([{ x: 9, y: 11 }, { x: 8, y: 11 }, { x: 7, y: 11 }]);
  const [dir, setDir] = useState<Pt>({ x: 1, y: 0 });
  const [food, setFood] = useState<Pt>({ x: 13, y: 11 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("zen-snake-best") || 0));
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const dirRef = useRef(dir);
  dirRef.current = dir;
  const stateRef = useRef({ snake, food, over, started });
  stateRef.current = { snake, food, over, started };

  const reset = useCallback(() => {
    const s = [{ x: 9, y: 11 }, { x: 8, y: 11 }, { x: 7, y: 11 }];
    setSnake(s);
    setDir({ x: 1, y: 0 });
    setFood(rndFree(s));
    setScore(0);
    setOver(false);
    setStarted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = dirRef.current;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        if (d.y !== 1) setDir({ x: 0, y: -1 });
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        if (d.y !== -1) setDir({ x: 0, y: 1 });
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        if (d.x !== 1) setDir({ x: -1, y: 0 });
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        if (d.x !== -1) setDir({ x: 1, y: 0 });
      } else if (e.key === "Enter" || e.key === " ") {
        if (!stateRef.current.started || stateRef.current.over) reset();
      } else if (e.key === "Escape") {
        api.hideGame().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  useEffect(() => {
    if (!started || over) return;
    const t = window.setInterval(() => {
      const st = stateRef.current;
      const head = st.snake[0];
      const d = dirRef.current;
      const nh = { x: head.x + d.x, y: head.y + d.y };
      if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS || st.snake.some((s) => s.x === nh.x && s.y === nh.y)) {
        setOver(true);
        setBest((b) => {
          const nb = Math.max(b, score);
          localStorage.setItem("zen-snake-best", String(nb));
          return nb;
        });
        return;
      }
      const ns = [nh, ...st.snake];
      if (nh.x === st.food.x && nh.y === st.food.y) {
        setFood(rndFree(ns));
        setScore((s) => s + 1);
        setSnake(ns);
      } else {
        ns.pop();
        setSnake(ns);
      }
    }, 110);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, over]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a09";
    ctx.fillRect(0, 0, W, H);
    // griglia tenue
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
      ctx.stroke();
    }
    // cibo: oro funzionale
    ctx.fillStyle = "#e8b04b";
    ctx.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
    // serpente: scala grigi guida §8
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#f0f0f0" : i < 4 ? "#d6d6d6" : i < 8 ? "#a8a8a8" : "#7c7c7c";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, [snake, food]);

  return (
    <div id="snake-root">
      <div id="snake-card">
        <div id="snake-header">
          <span id="snake-title">SNAKE</span>
          <span id="snake-score">PUNTI {score} • BEST {best}</span>
          <button id="snake-x" title="Chiudi" onClick={() => api.hideGame().catch(() => undefined)}>–</button>
        </div>
        <canvas ref={canvasRef} width={W} height={H} id="snake-canvas" />
        <div id="snake-footer">
          {!started ? (
            <button id="snake-go" onClick={reset}>gioca</button>
          ) : over ? (
            <button id="snake-go" onClick={reset}>rigioca (invio)</button>
          ) : (
            <span id="snake-hint">FRECCE / WASD • ESC CHIUDE</span>
          )}
        </div>
      </div>
    </div>
  );
}
