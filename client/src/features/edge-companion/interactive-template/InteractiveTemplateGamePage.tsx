import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useToast } from "@/hooks/use-toast";
import {
  EdgeCampaignLockedError,
  EdgeInteractCooldownError,
  type EdgeParticipantState,
  postEdgeParticipantInteract,
} from "@/lib/edge-participant";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";

const PT = TEMPLATE_PAGE_PADDING_TOP;

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  vx: number;
  vy: number;
  life: number;
  scale: number;
}
interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

const STEPS = [
  { title: "Шаг 1 из 3", target: 25, icon: "📖" },
  { title: "Шаг 2 из 3", target: 75, icon: "⚡" },
  { title: "Шаг 3 из 3", target: 150, icon: "🏆" },
];
const MOODS = [
  { min: 0, max: 24, label: "Спокоен", emoji: "😴", color: "#a78bfa", glow: "139,92,246" },
  { min: 25, max: 74, label: "Доволен", emoji: "😊", color: "#60a5fa", glow: "59,130,246" },
  { min: 75, max: 149, label: "Взволнован", emoji: "🤩", color: "#fbbf24", glow: "245,158,11" },
  { min: 150, max: Infinity, label: "Счастлив!", emoji: "🥳", color: "#34d399", glow: "16,185,129" },
];
const EMOJIS = ["✨", "⭐", "💥", "🌟", "💫", "🎯", "⚡", "🔥", "💜", "🎉"];
const MSGS = ["Ещё!", "Давай!", "О да!", "Ещё-ещё!", "Супер!", "Ай!", "Хи-хи!", "Жми!", "Вау!", "Класс!"];

const STEP_FINAL_TARGET = STEPS[STEPS.length - 1]!.target;

function recomputeStepUiFromTaps(
  tapCount: number,
  setDone: Dispatch<SetStateAction<Set<number>>>,
  setCurStep: Dispatch<SetStateAction<number>>,
  setReward: Dispatch<SetStateAction<boolean>>,
) {
  const newDone = new Set<number>();
  let newCurStep = 0;
  STEPS.forEach((st, idx) => {
    if (tapCount >= st.target) {
      newDone.add(idx);
      newCurStep = idx < STEPS.length - 1 ? idx + 1 : idx;
    }
  });
  setDone(newDone);
  setCurStep(newCurStep);
  if (tapCount < STEP_FINAL_TARGET) setReward(false);
}

/** Звук тапа/шага: стабильные колбэки + resume() в том же кадре, что и жест (иначе после await тишина). */
function useGameTapAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      try {
        const Win = window as unknown as {
          AudioContext?: new () => AudioContext;
          webkitAudioContext?: new () => AudioContext;
        };
        const Ctor = Win.AudioContext ?? Win.webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    return ctxRef.current;
  }, []);

  const resume = useCallback(() => {
    try {
      const c = getCtx();
      if (c?.state === "suspended") void c.resume();
    } catch {
      /* ignore */
    }
  }, [getCtx]);

  const note = useCallback(
    (freq: number, t: number, gain = 0.15, type: OscillatorType = "sine", dur = 0.14) => {
      try {
        const c = getCtx();
        if (!c) return;
        const o = c.createOscillator();
        const g = c.createGain();
        o.connect(g);
        g.connect(c.destination);
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(gain, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + dur);
        o.start(c.currentTime + t);
        o.stop(c.currentTime + t + dur + 0.02);
      } catch {
        /* ignore */
      }
    },
    [getCtx],
  );

  const tap = useCallback(
    (p = 1.0) => {
      note(520 * p, 0, 0.17);
      note(720 * p, 0, 0.09, "sine", 0.08);
    },
    [note],
  );

  const levelUp = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.2, "triangle", 0.3));
  }, [note]);

  const stepDone = useCallback(() => {
    [392, 523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.08, 0.17, "sine", 0.22));
  }, [note]);

  return useMemo(
    () => ({ resume, tap, levelUp, stepDone }),
    [resume, tap, levelUp, stepDone],
  );
}

export type InteractiveTemplateGamePageProps = {
  edgeId: string;
  campaignTitle: string;
  characterImageUrl: string;
  prizeLines: string[];
  participantState: EdgeParticipantState | undefined;
  interactLocked: boolean;
  onParticipantState: (s: EdgeParticipantState) => void;
  onRewardGoToPrizes?: () => void;
};

export function InteractiveTemplateGamePage({
  edgeId,
  campaignTitle,
  characterImageUrl,
  prizeLines,
  participantState,
  interactLocked,
  onParticipantState,
  onRewardGoToPrizes,
}: InteractiveTemplateGamePageProps) {
  const { toast } = useToast();
  const [taps, setTaps] = useState(0);
  const xp = participantState?.xp ?? 0;
  const level = participantState?.level ?? 0;
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [squeeze, setSqueeze] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [curStep, setCurStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [reward, setReward] = useState(false);
  const [msg, setMsg] = useState("Тапни меня!");
  const [streak, setStreak] = useState(0);
  const stTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pid = useRef(0);
  const tid = useRef(0);
  const tapPos = useRef<{ x: number; y: number } | null>(null);
  const tapsRef = useRef(0);
  const participantLevelRef = useRef(0);
  const interactQueueRef = useRef(Promise.resolve());
  const audio = useGameTapAudio();

  useEffect(() => {
    if (participantState) participantLevelRef.current = participantState.level;
  }, [participantState]);

  useEffect(() => {
    tapsRef.current = taps;
  }, [taps]);

  const moodKey = Math.min(taps, 150);
  const mood = MOODS.find((m) => moodKey >= m.min && moodKey <= m.max) ?? MOODS[0]!;
  const step = STEPS[Math.min(curStep, STEPS.length - 1)]!;
  const stepPct = Math.min((taps / step.target) * 100, 100);
  const totalPct = Math.min((taps / 150) * 100, 100);
  const xpPct = Math.min(xp % 100, 100);

  const prizesUi = prizeLines.length ? prizeLines.slice(0, 3) : ["Призы кампании", "Участвуй активно"];

  const addParticles = useCallback((x: number, y: number, n = 8) => {
    const ps: Particle[] = Array.from({ length: n }, () => ({
      id: ++pid.current,
      x,
      y,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!,
      vx: (Math.random() - 0.5) * 15,
      vy: -(Math.random() * 12 + 5),
      life: 1,
      scale: Math.random() * 0.95 + 0.55,
    }));
    setParticles((p) => [...p, ...ps]);
    setTimeout(
      () => setParticles((p) => p.filter((x) => !ps.find((np) => np.id === x.id))),
      1000,
    );
  }, []);

  const addText = useCallback((x: number, y: number, text: string, color: string) => {
    const id = ++tid.current;
    setFloats((p) => [...p, { id, x, y, text, color }]);
    setTimeout(() => setFloats((p) => p.filter((t) => t.id !== id)), 1100);
  }, []);

  const performTap = useCallback(
    (cx: number, cy: number) => {
      if (interactLocked || !participantState) {
        if (!participantState) {
          toast({ title: "Загрузка…", description: "Подождите данные участника.", variant: "destructive" });
        }
        return;
      }

      const n = tapsRef.current + 1;
      tapsRef.current = n;
      setTaps(n);

      audio.resume();
      audio.tap(0.85 + (n % 8) * 0.045);
      triggerTapFeedback({ haptic: true, sound: false });

      setSqueeze(true);
      setBounce(true);
      setTimeout(() => setSqueeze(false), 150);
      setTimeout(() => setBounce(false), 320);
      addParticles(cx, cy, 9);
      addText(cx, cy - 25, "Тап!", "#c4b5fd");

      setMsg(MSGS[Math.floor(Math.random() * MSGS.length)]!);
      if (stTimer.current) clearTimeout(stTimer.current);
      setStreak((s) => s + 1);
      stTimer.current = setTimeout(() => {
        setStreak(0);
        setMsg("Тапни меня!");
      }, 2500);

      STEPS.forEach((st, idx) => {
        if (n >= st.target) {
          setDone((prev) => {
            if (prev.has(idx)) return prev;
            const nn = new Set(prev);
            nn.add(idx);
            audio.stepDone();
            if (idx < STEPS.length - 1) setCurStep(idx + 1);
            if (idx === STEPS.length - 1) setTimeout(() => setReward(true), 700);
            return nn;
          });
        }
      });

      interactQueueRef.current = interactQueueRef.current.then(async () => {
        const levelBeforeRequest = participantLevelRef.current;
        try {
          const next = await postEdgeParticipantInteract(edgeId, "tap");
          onParticipantState(next);
          participantLevelRef.current = next.level;
          if (next.level > levelBeforeRequest) {
            audio.levelUp();
            addParticles(cx, cy, 22);
            addText(cx, cy - 40, `🎉 LEVEL UP ${next.level}!`, "#fbbf24");
          }
        } catch (e) {
          tapsRef.current = Math.max(0, tapsRef.current - 1);
          setTaps(tapsRef.current);
          recomputeStepUiFromTaps(tapsRef.current, setDone, setCurStep, setReward);
          if (e instanceof EdgeInteractCooldownError) {
            toast({ title: "Пауза", description: e.message, variant: "destructive" });
          } else if (e instanceof EdgeCampaignLockedError) {
            toast({ title: "Кампания недоступна", description: e.message, variant: "destructive" });
          } else {
            toast({
              title: "Не удалось",
              description: e instanceof Error ? e.message : "Повторите позже.",
              variant: "destructive",
            });
          }
        }
      });
    },
    [
      addParticles,
      addText,
      audio,
      edgeId,
      interactLocked,
      onParticipantState,
      participantState,
      toast,
    ],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      void performTap(e.clientX - rect.left, e.clientY - rect.top);
    },
    [performTap],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    tapPos.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!tapPos.current) return;
      const dx = Math.abs(e.changedTouches[0]!.clientX - tapPos.current.x);
      const dy = Math.abs(e.changedTouches[0]!.clientY - tapPos.current.y);
      if (dx < 15 && dy < 15) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        void performTap(
          e.changedTouches[0]!.clientX - rect.left,
          e.changedTouches[0]!.clientY - rect.top,
        );
      }
      tapPos.current = null;
    },
    [performTap],
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setParticles((p) =>
        p
          .map((x) => ({
            ...x,
            x: x.x + x.vx,
            y: x.y + x.vy,
            vy: x.vy + 0.55,
            life: x.life - 0.07,
          }))
          .filter((x) => x.life > 0),
      );
    }, 28);
    return () => clearInterval(iv);
  }, []);

  const sc = squeeze ? 0.9 : bounce ? 1.08 : 1;
  const ro = squeeze ? (Math.random() > 0.5 ? 6 : -6) : 0;
  const imgSrc = characterImageUrl.trim() || "/edge-interactive/chick.png";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100%",
        background: "#060b18",
        overflow: "hidden",
        cursor: interactLocked || !participantState ? "default" : "pointer",
        fontFamily: "'Inter',-apple-system,sans-serif",
        WebkitUserSelect: "none",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="presentation"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 90% 65% at 50% 62%, rgba(${mood.glow},0.2) 0%, rgba(${mood.glow},0.05) 50%, transparent 75%)`,
          transition: "background 1.2s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "42%",
          pointerEvents: "none",
          background:
            "linear-gradient(0deg,rgba(3,5,14,0.98) 0%,rgba(4,7,16,0.82) 55%,transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "30%",
          pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(3,5,14,0.85) 0%,transparent 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          animation: squeeze || bounce ? "none" : "edgeFloatChar 3.6s ease-in-out infinite",
          marginTop: "-5vh",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "70vw",
            height: "70vw",
            borderRadius: "50%",
            background: `radial-gradient(circle,rgba(${mood.glow},0.22) 0%,transparent 65%)`,
            animation: "edgeGlowPulse 2.8s ease-in-out infinite",
            transition: "background 1s ease",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: "min(92vw, 480px)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.94)",
              borderRadius: 14,
              padding: "4px 14px",
              maxWidth: "100%",
              boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
              alignSelf: "center",
            }}
          >
            <div
              style={{
                color: "#1a0a2e",
                fontWeight: 800,
                fontSize: 13,
                lineHeight: 1.25,
                textAlign: "center",
              }}
            >
              {msg}
            </div>
          </div>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "8px solid rgba(255,255,255,0.94)",
              filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))",
              marginTop: -1,
              marginBottom: 2,
            }}
          />
          <img
            src={imgSrc}
            alt=""
            style={{
              width: "min(82vw, 460px)",
              objectFit: "contain",
              display: "block",
              background: "transparent",
              transform: `scale(${sc}) rotate(${ro}deg)`,
              transition: squeeze
                ? "transform 0.07s cubic-bezier(0.25,0,0.5,1)"
                : bounce
                  ? "transform 0.24s cubic-bezier(0.34,1.56,0.64,1)"
                  : "transform 0.2s ease",
              filter: `drop-shadow(0 0 55px rgba(${mood.glow},0.9)) drop-shadow(0 20px 38px rgba(0,0,0,0.65))`,
              pointerEvents: "none",
            }}
            draggable={false}
          />
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              fontSize: 22 * p.scale,
              opacity: p.life,
              transform: `translate(-50%,-50%) scale(${p.scale})`,
              pointerEvents: "none",
            }}
          >
            {p.emoji}
          </div>
        ))}
        {floats.map((t) => (
          <div
            key={t.id}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y,
              color: t.color,
              fontWeight: 900,
              fontSize: 16,
              pointerEvents: "none",
              transform: "translate(-50%,-100%)",
              animation: "edgeFloatUp 1.1s ease forwards",
              textShadow: `0 0 16px ${t.color}`,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 30, padding: `${PT + 8}px 20px 0` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#7c3aed,#3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              boxShadow: "0 0 16px rgba(124,58,237,0.8)",
              flexShrink: 0,
            }}
          >
            ✦
          </div>
          <span
            style={{
              color: "#c4b5fd",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Интерактив
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {streak >= 3 && (
              <span
                style={{
                  background: "linear-gradient(135deg,#f59e0b,#ef4444)",
                  borderRadius: 18,
                  padding: "2px 9px",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 11,
                  boxShadow: "0 0 14px rgba(245,158,11,0.65)",
                }}
              >
                🔥 ×{streak}
              </span>
            )}
            <span style={{ color: "rgba(167,139,250,0.65)", fontSize: 11, fontWeight: 700 }}>
              {done.size}/{STEPS.length} шагов
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 auto", maxWidth: "46%" }}>
            <div
              style={{
                color: "rgba(251,191,36,0.6)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 5,
              }}
            >
              🎁 Призы:
            </div>
            {prizesUi.map((prize, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: `rgba(${mood.glow},1)`,
                    flexShrink: 0,
                    boxShadow: `0 0 6px rgba(${mood.glow},0.8)`,
                  }}
                />
                <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>
                  {prize}
                </span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 12 }}>{step.icon}</span>
              <span style={{ color: "#d4d8e8", fontWeight: 700, fontSize: 11 }}>{step.title}</span>
              {done.has(curStep) && (
                <span style={{ color: "#34d399", fontSize: 10, fontWeight: 700 }}>✓</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
              <div
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 5,
                  height: 5,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${stepPct}%`,
                    background: done.has(curStep)
                      ? "linear-gradient(90deg,#10b981,#34d399)"
                      : `linear-gradient(90deg,rgba(${mood.glow},1),rgba(${mood.glow},0.5))`,
                    borderRadius: 5,
                    transition: "width 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                    boxShadow: `0 0 8px rgba(${mood.glow},0.7)`,
                  }}
                />
              </div>
              <span
                style={{
                  color: "rgba(180,195,220,0.32)",
                  fontSize: 10,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {Math.min(taps, step.target)}/{step.target}
              </span>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === curStep ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    background: done.has(i)
                      ? "#10b981"
                      : i === curStep
                        ? `rgba(${mood.glow},1)`
                        : "rgba(255,255,255,0.08)",
                    transition: "all 0.35s ease",
                    boxShadow: i === curStep ? `0 0 8px rgba(${mood.glow},0.9)` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          padding: "0 20px max(env(safe-area-inset-bottom,16px),16px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div
              style={{
                color: "rgba(180,195,220,0.32)",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                marginBottom: 2,
              }}
            >
              Тапов (сессия)
            </div>
            <div
              style={{
                color: "#f1f5f9",
                fontWeight: 900,
                fontSize: 36,
                lineHeight: 1,
                letterSpacing: -2,
                textShadow: `0 0 20px rgba(${mood.glow},0.55)`,
              }}
            >
              {taps}
            </div>
            <div style={{ color: "rgba(180,195,220,0.2)", fontSize: 10, marginTop: 2 }}>из 150</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 2 }}>{mood.emoji}</div>
            <div style={{ color: mood.color, fontSize: 12, fontWeight: 700, transition: "color 0.8s ease" }}>
              {mood.label}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 5,
                justifyContent: "flex-end",
                marginBottom: 3,
              }}
            >
              <span
                style={{
                  color: "rgba(180,195,220,0.32)",
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                Ур.
              </span>
              <span
                style={{
                  color: "#fbbf24",
                  fontWeight: 900,
                  fontSize: 30,
                  lineHeight: 1,
                  textShadow: "0 0 18px rgba(251,191,36,0.7)",
                }}
              >
                {level}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 5,
                justifyContent: "flex-end",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: "rgba(180,195,220,0.32)",
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                XP
              </span>
              <span
                style={{
                  color: "#c4b5fd",
                  fontWeight: 800,
                  fontSize: 20,
                  lineHeight: 1,
                  textShadow: "0 0 12px rgba(196,181,253,0.65)",
                }}
              >
                {xp}
              </span>
            </div>
            <div
              style={{
                width: 52,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 4,
                height: 4,
                overflow: "hidden",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${xpPct}%`,
                  background: "linear-gradient(90deg,#7c3aed,#c4b5fd)",
                  borderRadius: 4,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span
            style={{
              color: "rgba(180,195,220,0.35)",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ flexShrink: 0 }} aria-hidden>
              🏆
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {campaignTitle.slice(0, 42)}
              {campaignTitle.length > 42 ? "…" : ""}
            </span>
          </span>
          <span style={{ color: "rgba(180,195,220,0.22)", fontSize: 11 }}>
            {done.size === 3 ? "🎉 Выполнено!" : `${Math.max(0, 150 - taps)} тапов осталось`}
          </span>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 6,
            height: 6,
            overflow: "hidden",
            marginBottom: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${totalPct}%`,
              background: `linear-gradient(90deg,#7c3aed,rgba(${mood.glow},1),#a78bfa)`,
              borderRadius: 6,
              transition: "width 0.45s cubic-bezier(0.34,1.56,0.64,1)",
              boxShadow: `0 0 10px rgba(${mood.glow},0.6)`,
              position: "relative",
            }}
          >
            {totalPct > 4 && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 0 10px rgba(255,255,255,1)",
                }}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            void performTap(rect.width / 2, rect.height / 2);
          }}
          disabled={interactLocked || !participantState}
          style={{
            width: "100%",
            background: `linear-gradient(135deg,rgba(${mood.glow},0.88),#7c3aed)`,
            border: "none",
            borderRadius: 18,
            padding: "16px 24px",
            color: "white",
            fontWeight: 800,
            fontSize: 17,
            cursor: interactLocked || !participantState ? "not-allowed" : "pointer",
            opacity: interactLocked || !participantState ? 0.5 : 1,
            boxShadow: `0 10px 36px rgba(${mood.glow},0.42),0 2px 10px rgba(0,0,0,0.5)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "transform 0.1s ease",
          }}
          onMouseDown={(e) => {
            if (!interactLocked && participantState) e.currentTarget.style.transform = "scale(0.97)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span style={{ fontSize: 20 }}>🎮</span>
          <span>Тапнуть!</span>
          <span
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: "3px 11px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            +5 XP
          </span>
        </button>
      </div>

      {reward && (
        <div
          role="dialog"
          aria-modal
          onClick={(e) => {
            e.stopPropagation();
            setReward(false);
          }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60,
            background: "rgba(4,7,18,0.95)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 90, animation: "edgePopIn 0.5s ease", marginBottom: 20 }}>🎉</div>
          <div
            style={{
              color: "#f1f5f9",
              fontWeight: 900,
              fontSize: 30,
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            Поздравляем!
          </div>
          <div
            style={{
              color: "rgba(180,195,220,0.45)",
              fontSize: 15,
              textAlign: "center",
              padding: "0 48px",
              marginBottom: 36,
              lineHeight: 1.7,
            }}
          >
            Ты прошёл все 3 шага квеста в этой сессии!
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setReward(false);
              onRewardGoToPrizes?.();
            }}
            style={{
              background: "linear-gradient(135deg,#f59e0b,#ef4444)",
              border: "none",
              borderRadius: 22,
              padding: "18px 50px",
              color: "white",
              fontWeight: 800,
              fontSize: 18,
              boxShadow: "0 0 50px rgba(245,158,11,0.6)",
              cursor: "pointer",
            }}
          >
            🎁 Забрать приз
          </button>
          <div style={{ color: "rgba(255,255,255,0.1)", fontSize: 13, marginTop: 24 }}>Нажми чтобы закрыть</div>
        </div>
      )}

      <style>{`
        @keyframes edgeFloatUp {
          0% { transform: translate(-50%,-100%); opacity: 1; }
          100% { transform: translate(-50%,-280%); opacity: 0; }
        }
        @keyframes edgeGlowPulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%,-30%) scale(1); }
          50% { opacity: 1; transform: translate(-50%,-30%) scale(1.1); }
        }
        @keyframes edgePopIn {
          0% { transform: scale(0.2); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes edgeFloatChar {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
}
