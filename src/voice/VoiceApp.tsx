import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "../api";

// ZEN TITAN — overlay vocale simultaneo: capisce ed esegue MENTRE parli
// (ogni azione completa parte subito, in parallelo), riepilogo parlato
// alla fine. Se per 10s non sente parole per lui, si chiude da solo.

type Phase = "idle" | "cmd" | "busy" | "done";

const CONN = /(\s+e\s+poi\s+|\s+e\s+dopo\s+|\s+e\s+quindi\s+|\s+e\s+allora\s+|\s+poi\s+|\s+dopo\s+|\s+quindi\s+|\s+allora\s+|,\s*)/i;
const IDLE_MS = 10000;
const ENDPOINT_MS = 1200;

function makeRec(continuous: boolean): any | null {
  const w = window as unknown as Record<string, any>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "it-IT";
  r.continuous = continuous;
  r.interimResults = true;
  return r;
}

function stopRec(ref: React.MutableRefObject<any | null>) {
  const r = ref.current;
  ref.current = null;
  if (!r) return;
  try {
    r.onend = null;
    r.onresult = null;
    r.onerror = null;
    if (typeof r.stop === "function") r.stop();
  } catch {
    /* già fermo */
  }
}

function cleanSeg(s: string): string {
  return s
    .replace(/^\s*zen\b/i, "")
    .replace(/^\s*(e\s+poi|poi|e|dopo|quindi|allora)\b\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VoiceApp() {
  const [supported, setSupported] = useState(true);
  const [listenOn, setListenOn] = useState(true);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [runs, setRuns] = useState(0);
  const wakeRef = useRef<any | null>(null);
  const cmdRef = useRef<any | null>(null);
  const hideTimer = useRef(0);
  const idleTimer = useRef(0);
  const endTimer = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const listenRef = useRef(true);
  listenRef.current = listenOn;
  const visibleRef = useRef(false);
  visibleRef.current = visible;
  // Stato esecuzione simultanea (ref: niente re-render a ogni sillaba)
  const committedRef = useRef(0);
  const pendingRunsRef = useRef(0);
  const micClosedRef = useRef(false);
  const answersRef = useRef<string[]>([]);
  const startedRef = useRef(false);
  // Ultimo pezzo lanciato: contesto per il successivo
  const lastSegRef = useRef<string | null>(null);

  const clearTimers = () => {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(idleTimer.current);
    window.clearTimeout(endTimer.current);
  };

  const closeVoice = useCallback(() => {
    clearTimers();
    stopRec(wakeRef);
    stopRec(cmdRef);
    try {
      speechSynthesis.cancel();
    } catch {
      /* niente voce */
    }
    api.hideVoice().catch(() => undefined);
    setVisible(false);
    setPhase("idle");
    setHeard("");
    setAnswer("");
    setRuns(0);
  }, []);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => closeVoice(), 5000);
  }, [closeVoice]);

  const speak = useCallback(
    (text: string) => {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.slice(0, 600));
        u.lang = "it-IT";
        const vs = speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().startsWith("it"));
        if (vs[0]) u.voice = vs[0];
        u.onend = () => scheduleHide();
        u.onerror = () => scheduleHide();
        speechSynthesis.speak(u);
      } catch {
        scheduleHide();
      }
    },
    [scheduleHide],
  );

  const maybeFinish = useCallback(() => {
    if (!micClosedRef.current || pendingRunsRef.current > 0) return;
    if (!startedRef.current) {
      closeVoice(); // solo rumore: chiudi in silenzio
      return;
    }
    const summary = answersRef.current.filter((a) => a.trim() !== "").join(". ");
    const clean = (summary.trim() || "Fatto.").slice(0, 600);
    setAnswer(clean);
    setPhase("done");
    speak(clean);
  }, [closeVoice, speak]);

  const dispatchSegment = useCallback(
    (seg: string, prev: string | null) => {
      startedRef.current = true;
      pendingRunsRef.current += 1;
      setRuns(pendingRunsRef.current);
      setPhase("busy");
      // I frammenti ("un altro") da soli non significano nulla:
      // gli si cuce il pezzo prima come contesto.
      const prompt = prev ? `Contesto: ${prev}. Istruzione: ${seg}` : seg;
      api
        .run(prompt, true, [])
        .then((out) => {
          const t = (out || "Fatto.").trim();
          if (t) answersRef.current.push(t);
        })
        .catch(() => {
          answersRef.current.push("Non sono riuscito a fare una cosa.");
        })
        .finally(() => {
          pendingRunsRef.current -= 1;
          setRuns(pendingRunsRef.current);
          maybeFinish();
        });
    },
    [maybeFinish],
  );

  // Fa partire i pezzi completi del parlato (tutti tranne l'ultimo, ancora
  // in bocca). Ritorna quanti ne ha lanciati.
  const dispatchCompletes = useCallback(
    (full: string, forceLast: boolean, minWords: number): number => {
      let start = committedRef.current;
      if (start > full.length) start = full.length;
      const suffix = full.slice(start);
      if (!suffix.trim()) return 0;
      const tokens = suffix.split(CONN);
      let launched = 0;
      const lastIdx = tokens.length - 1;
      let prev: string | null = lastSegRef.current;
      for (let i = 0; i < tokens.length; i += 2) {
        const isLast = i === lastIdx;
        if (isLast && !forceLast) break;
        const seg = cleanSeg(tokens[i]);
        const words = seg.split(/\s+/).filter(Boolean).length;
        if (seg.length >= 2 && words >= (isLast ? minWords : 1)) {
          dispatchSegment(seg, prev);
          prev = seg;
          launched += 1;
        }
        committedRef.current += tokens[i].length + (i + 1 < tokens.length ? tokens[i + 1].length : 0);
      }
      if (launched > 0 && prev) lastSegRef.current = prev;
      return launched;
    },
    [dispatchSegment],
  );

  const pokeIdle = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      // 10s senza parole per lui: la chat audio si chiude da sola
      if (phaseRef.current === "cmd") closeVoice();
    }, IDLE_MS);
  }, [closeVoice]);

  const pokeEndpoint = useCallback(
    (full: string) => {
      window.clearTimeout(endTimer.current);
      endTimer.current = window.setTimeout(() => {
        // 1,2s di silenzio: il pezzo in bocca è completo, parte subito
        if (phaseRef.current !== "cmd" && phaseRef.current !== "busy") return;
        dispatchCompletes(full, true, 2);
      }, ENDPOINT_MS);
    },
    [dispatchCompletes],
  );

  const fullOf = (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
    let txt = "";
    for (let i = 0; i < e.results.length; i++) txt += ` ${e.results[i][0].transcript}`;
    return txt.replace(/\s+/g, " ").trim();
  };

  const startWake = useCallback(() => {
    stopRec(wakeRef);
    stopRec(cmdRef);
    if (!listenRef.current) return;
    const r = makeRec(true);
    if (!r) {
      setSupported(false);
      return;
    }
    wakeRef.current = r;
    r.onresult = (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += ` ${e.results[i][0].transcript}`;
      if (txt.toLowerCase().includes("zen")) triggerCommand();
    };
    r.onend = () => {
      if (phaseRef.current === "idle" && listenRef.current && wakeRef.current === r) {
        window.setTimeout(() => {
          if (phaseRef.current === "idle" && listenRef.current) startWake();
        }, 800);
      }
    };
    r.onerror = () => {
      /* rumori/rete: onend riaccende */
    };
    try {
      r.start();
    } catch {
      /* già attivo */
    }
  }, []);

  const triggerCommand = useCallback(() => {
    clearTimers();
    api.showVoice().catch(() => undefined);
    setVisible(true);
    stopRec(wakeRef);
    setHeard("");
    setAnswer("");
    setRuns(0);
    committedRef.current = 0;
    pendingRunsRef.current = 0;
    micClosedRef.current = false;
    answersRef.current = [];
    startedRef.current = false;
    lastSegRef.current = null;
    setPhase("cmd");
    pokeIdle();
    const r = makeRec(true);
    if (!r) {
      setSupported(false);
      return;
    }
    cmdRef.current = r;
    r.onresult = (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
      const full = fullOf(e);
      setHeard(full);
      pokeIdle(); // parole per lui: il conto dei 10s riparte
      pokeEndpoint(full);
      // Pezzi completi partono SUBITO, mentre continua a parlare
      dispatchCompletes(full, false, 2);
    };
    r.onend = () => {
      // Bocca chiusa: tutto ciò che resta parte come finale
      micClosedRef.current = true;
      window.clearTimeout(endTimer.current);
      window.clearTimeout(idleTimer.current);
      const h = heardRef.current;
      if (h) dispatchCompletes(h, true, 1);
      maybeFinish();
    };
    r.onerror = () => {
      /* onend gestisce */
    };
    try {
      r.start();
    } catch {
      /* già attivo */
    }
  }, [dispatchCompletes, maybeFinish, pokeEndpoint, pokeIdle]);

  const heardRef = useRef("");
  heardRef.current = heard;

  // Visualizzatore audio: barre oro dal microfono.
  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | null = null;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 64;
        src.connect(an);
        analyserRef.current = an;
      } catch {
        setSupported(false);
      }
    })();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      const an = analyserRef.current;
      if (!cv || !an || !visibleRef.current) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const data = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);
      const W = cv.width;
      const H = cv.height;
      g.clearRect(0, 0, W, H);
      const n = 24;
      const bw = W / n;
      for (let i = 0; i < n; i++) {
        const v = data[Math.floor((i / n) * data.length)] / 255;
        const h = Math.max(3, v * H);
        g.fillStyle = "#e8b04b";
        g.fillRect(i * bw + 2, H - h, bw - 4, h);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      try {
        ctx?.close();
      } catch {
        /* chiuso */
      }
    };
  }, []);

  useEffect(() => {
    try {
      speechSynthesis.getVoices();
    } catch {
      /* niente voci */
    }
    api
      .getVoiceListen()
      .then((v) => {
        setListenOn(v);
        listenRef.current = v;
        if (v) startWake();
      })
      .catch(() => startWake());
    let alive = true;
    listen("zen-voice-trigger", () => {
      if (alive) triggerCommand();
    }).catch(() => undefined);
    listen<boolean>("zen-voice-listen", (e) => {
      if (!alive) return;
      setListenOn(e.payload);
      listenRef.current = e.payload;
      if (e.payload && phaseRef.current === "idle") startWake();
      if (!e.payload) {
        stopRec(wakeRef);
        stopRec(cmdRef);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [startWake, triggerCommand]);

  const status =
    phase === "cmd"
      ? runs > 0
        ? `eseguo ${runs} azioni mentre parli...`
        : "ti ascolto... parla pure"
      : phase === "busy"
        ? runs > 0
          ? `eseguo ${runs} azioni mentre parli...`
          : "ZEN TITAN esegue..."
        : phase === "done"
          ? "fatto"
          : listenOn
            ? 'di\' "zen" oppure premi il microfono'
            : "ascolto spento dalle impostazioni";

  return (
    <div id="voice-root">
      <div id="voice-card">
        <div id="voice-header">
          <span id="voice-dot" />
          <span id="voice-title">ZEN TITAN</span>
          <button className="icon-btn" title="Chiudi" onClick={closeVoice}>
            ✕
          </button>
        </div>
        {!supported ? (
          <div id="voice-unsupported">microfono o voce non supportati in questa finestra</div>
        ) : (
          <>
            <canvas id="voice-viz" ref={canvasRef} width={380} height={64} />
            <div id="voice-status">{status}</div>
            {heard && <div id="voice-heard">«{heard}»</div>}
            {answer && <div id="voice-answer">{answer}</div>}
            <button id="voice-mic" title="Parla" onClick={triggerCommand}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
