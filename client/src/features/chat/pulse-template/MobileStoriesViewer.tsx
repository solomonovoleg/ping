import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MoreHorizontal, Send, Share2, Volume2, VolumeX, X } from "lucide-react";

interface Story {
  id: number;
  bg?: string;
  photo?: string;
  duration: number;
}

interface StoryUser {
  id: number;
  username: string;
  displayName: string;
  initials: string;
  avatarGradient: string;
  time: string;
  stories: Story[];
}

interface StoriesViewerProps {
  initialMode?: "own" | "other";
  onClose?: () => void;
}

const USERS: StoryUser[] = [
  {
    id: 1,
    username: "mu.na.si",
    displayName: "Muna Siddiqui",
    initials: "MC",
    avatarGradient: "linear-gradient(135deg,#d62976,#962fbf)",
    time: "3 h",
    stories: [
      { id: 1, photo: "/creator-oleg-solomonov.png", duration: 6000 },
      { id: 2, bg: "linear-gradient(160deg,#1a0533,#4b1fa8,#0d0d2b)", duration: 5000 },
      { id: 3, bg: "linear-gradient(160deg,#7c0a32,#2d0015,#0a1628)", duration: 5000 },
    ],
  },
  {
    id: 2,
    username: "alex_travels",
    displayName: "Alex K.",
    initials: "AK",
    avatarGradient: "linear-gradient(135deg,#0369a1,#6366f1)",
    time: "1 h",
    stories: [
      { id: 4, bg: "linear-gradient(160deg,#0a1628,#1e3a5f,#0f3460)", duration: 5000 },
      { id: 5, bg: "linear-gradient(160deg,#065f46,#052e1c,#010e07)", duration: 5000 },
    ],
  },
  {
    id: 3,
    username: "mari_d",
    displayName: "Mari D.",
    initials: "MD",
    avatarGradient: "linear-gradient(135deg,#fb923c,#ef4444)",
    time: "47 min",
    stories: [{ id: 6, bg: "linear-gradient(160deg,#7c2d12,#3a0f04,#110401)", duration: 5000 }],
  },
];

const STORY_CONTENT: Record<number, { headline: string; sub: string; emoji: string }> = {
  2: { headline: "Night Dubai", sub: "Towers in lights", emoji: "🌃" },
  3: { headline: "Sunset", sub: "Scarlet clouds over the sea", emoji: "🌅" },
  4: { headline: "Tokyo", sub: "Haneda airport, just now", emoji: "🗼" },
  5: { headline: "Forest", sub: "Early mountain morning", emoji: "🌲" },
  6: { headline: "Desert", sub: "Red dunes", emoji: "🏜️" },
};

const TAP_MOVE_MAX_PX = 10;
const TAP_MAX_MS = 220;
const H_SWIPE_START_PX = 16;
const H_SWIPE_COMMIT_PX = 58;
const V_SWIPE_START_PX = 14;
const V_SWIPE_CLOSE_COMMIT_PX = 84;

function MobileStoriesViewerComponent({ initialMode = "own", onClose }: StoriesViewerProps = {}) {
  const [userIdx, setUserIdx] = useState(initialMode === "other" ? 1 : 0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likeAnim, setLikeAnim] = useState(false);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const lastTap = useRef(0);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const pointerIntentRef = useRef<"none" | "tap" | "swipe-x" | "swipe-y">("none");

  const user = USERS[userIdx] ?? USERS[0];
  const story = user.stories[storyIdx] ?? user.stories[0];
  const likeKey = `${userIdx}-${storyIdx}`;
  const isLiked = !!liked[likeKey];
  const content = useMemo(() => STORY_CONTENT[story.id] ?? null, [story.id]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const goNext = useCallback(() => {
    const stories = USERS[userIdx]?.stories ?? [];
    if (storyIdx < stories.length - 1) {
      setStoryIdx((i) => i + 1);
      return;
    }
    if (userIdx < USERS.length - 1) {
      setUserIdx((u) => u + 1);
      setStoryIdx(0);
      return;
    }
    onClose?.();
  }, [onClose, storyIdx, userIdx]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      return;
    }
    if (userIdx > 0) {
      setUserIdx((u) => u - 1);
      setStoryIdx((USERS[userIdx - 1]?.stories.length ?? 1) - 1);
    }
  }, [storyIdx, userIdx]);

  const goNextUser = useCallback(() => {
    if (userIdx < USERS.length - 1) {
      setUserIdx((u) => u + 1);
      setStoryIdx(0);
      setProgress(0);
      return;
    }
    onClose?.();
  }, [onClose, userIdx]);

  const goPrevUser = useCallback(() => {
    if (userIdx > 0) {
      setUserIdx((u) => u - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [userIdx]);

  useEffect(() => {
    if (paused) return;
    const interval = 60;
    const step = interval / story.duration;
    const t = setInterval(() => {
      setProgress((p) => {
        if (p + step >= 1) {
          goNext();
          return 0;
        }
        return p + step;
      });
    }, interval);
    return () => clearInterval(t);
  }, [goNext, paused, story.duration, storyIdx, userIdx]);

  useEffect(() => {
    setProgress(0);
  }, [storyIdx, userIdx]);

  const onMainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    pointerIntentRef.current = "tap";
    setPaused(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onMainPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (pointerIntentRef.current === "tap") {
      if (absX <= TAP_MOVE_MAX_PX && absY <= TAP_MOVE_MAX_PX) return;
      if (absY > absX && absY > V_SWIPE_START_PX) {
        pointerIntentRef.current = "swipe-y";
        return;
      }
      if (absX > absY && absX > H_SWIPE_START_PX) {
        pointerIntentRef.current = "swipe-x";
        return;
      }
      pointerIntentRef.current = "none";
    }
  };

  const finishMainPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setPaused(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const heldMs = Date.now() - start.at;
    const intent = pointerIntentRef.current;
    pointerIntentRef.current = "none";

    if (intent === "swipe-y") {
      if (dy < -V_SWIPE_CLOSE_COMMIT_PX && absY > absX * 1.15) onClose?.();
      return;
    }

    if (intent === "swipe-x") {
      if (absX < H_SWIPE_COMMIT_PX || absX < absY * 1.1) return;
      if (dx < 0) goNextUser();
      else goPrevUser();
      return;
    }

    if (absX > TAP_MOVE_MAX_PX || absY > TAP_MOVE_MAX_PX) return;
    if (heldMs > TAP_MAX_MS) return;

    const now = Date.now();
    if (now - lastTap.current < 280) {
      setLiked((l) => ({ ...l, [likeKey]: true }));
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 900);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x <= rect.width * 0.32) {
      goPrev();
      return;
    }
    if (x >= rect.width * 0.68) goNext();
  };

  const onMainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishMainPointer(e);
  };

  const onMainPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    pointerIntentRef.current = "none";
    setPaused(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked((l) => ({ ...l, [likeKey]: !l[likeKey] }));
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 550);
  };

  const timerStr = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      style={{
        width: 390,
        height: 844,
        position: "relative",
        overflow: "hidden",
        background: "#000",
        fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
        userSelect: "none",
      }}
    >
      <style>{`
        @keyframes svHeartPop { 0%{transform:scale(0.5);opacity:0} 40%{transform:scale(1.35);opacity:1} 70%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
        @keyframes svHeartBig { 0%{transform:translate(-50%,-50%) scale(0);opacity:0} 20%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 70%{opacity:1} 100%{transform:translate(-50%,-50%) scale(1.1);opacity:0} }
        @keyframes svFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div
        onPointerDown={onMainPointerDown}
        onPointerMove={onMainPointerMove}
        onPointerUp={onMainPointerUp}
        onPointerCancel={onMainPointerCancel}
        style={{ position: "absolute", inset: 0, zIndex: 1, touchAction: "none" }}
      >
        {story.photo ? (
          <img
            src={story.photo}
            alt={user.displayName}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: story.bg }} />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 26%, transparent 60%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {doubleTapHeart && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "50%",
            zIndex: 50,
            pointerEvents: "none",
            fontSize: 88,
            lineHeight: 1,
            animation: "svHeartBig 0.9s ease forwards",
            filter: "drop-shadow(0 4px 16px rgba(251,113,133,0.6))",
          }}
        >
          ❤️
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px 0",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{timerStr}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
            {[2, 5, 8, 12].map((h, i) => (
              <rect
                key={i}
                x={i * 4.5}
                y={12 - h}
                width="3"
                height={h}
                rx="1"
                fill={i < 3 ? "white" : "rgba(255,255,255,0.3)"}
              />
            ))}
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
            <path
              d="M8 3C5.5 3 3.3 4.1 1.8 5.8L0 4C2 1.8 4.8.5 8 .5s6 1.3 8 3.5l-1.8 1.8C12.7 4.1 10.5 3 8 3z"
              fill="white"
            />
            <path
              d="M8 6.5c-1.4 0-2.6.6-3.5 1.5L3 6.5C4.3 5.1 6 4.2 8 4.2s3.7.9 5 2.3l-1.5 1.5C10.6 7.1 9.4 6.5 8 6.5z"
              fill="white"
            />
            <circle cx="8" cy="11" r="1.5" fill="white" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>28%</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 36,
          left: 10,
          right: 10,
          zIndex: 10,
          display: "flex",
          gap: 3,
        }}
      >
        {user.stories.map((s, i) => {
          const fill = i < storyIdx ? 1 : i === storyIdx ? progress : 0;
          return (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 99,
                background: "rgba(255,255,255,0.32)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${fill * 100}%`,
                  borderRadius: 99,
                  background: "white",
                  transition: i === storyIdx ? "none" : "width 0.3s ease",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: 48,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: user.avatarGradient,
            border: "2px solid rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            color: "white",
          }}
        >
          {user.initials}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{user.username}</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{user.time}</span>
        </div>
        {[
          {
            icon: muted ? <VolumeX size={15} /> : <Volume2 size={15} />,
            ariaLabel: muted ? "Unmute" : "Mute",
            onClick: () => setMuted((m) => !m),
          },
          { icon: <MoreHorizontal size={17} />, ariaLabel: "More options", onClick: () => {} },
          { icon: <X size={17} />, ariaLabel: "Close stories", onClick: () => onClose?.() },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              btn.onClick();
            }}
            aria-label={btn.ariaLabel}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.3)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {content && !story.photo && (
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: 0,
            right: 0,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "0 32px",
            animation: "svFadeIn 0.4s ease",
          }}
        >
          <span style={{ fontSize: 56, lineHeight: 1 }}>{content.emoji}</span>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "white",
              textAlign: "center",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {content.headline}
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
              fontWeight: 500,
              margin: 0,
            }}
          >
            {content.sub}
          </p>
        </div>
      )}

      {userIdx > 0 && (
        <div
          style={{
            position: "absolute",
            left: -28,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 8,
            opacity: 0.65,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: USERS[userIdx - 1]?.avatarGradient,
              border: "2px solid rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "white",
            }}
          >
            {USERS[userIdx - 1]?.initials}
          </div>
        </div>
      )}

      {userIdx < USERS.length - 1 && (
        <div
          style={{
            position: "absolute",
            right: -28,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 8,
            opacity: 0.65,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: USERS[userIdx + 1]?.avatarGradient,
              border: "2px solid rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "white",
            }}
          >
            {USERS[userIdx + 1]?.initials}
          </div>
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: "12px 14px 34px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(16px)",
            borderRadius: 26,
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "12px 18px",
            minHeight: 48,
          }}
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send message..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "white",
              caretColor: "white",
            }}
          />
          {message && (
            <button
              onClick={() => setMessage("")}
              aria-label="Send message"
              style={{
                background: "rgba(99,102,241,0.9)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                marginLeft: 8,
              }}
            >
              <Send size={14} color="white" />
            </button>
          )}
        </div>
        <button
          onClick={handleLike}
          aria-label={isLiked ? "Unlike story" : "Like story"}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Heart
            size={20}
            color={isLiked ? "#fb7185" : "white"}
            fill={isLiked ? "#fb7185" : "none"}
            style={{
              animation: likeAnim
                ? "svHeartPop 0.55s cubic-bezier(0.175,0.885,0.32,1.275)"
                : "none",
            }}
          />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          aria-label="Share story"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Share2 size={18} color="white" />
        </button>
      </div>

    </div>
  );
}

export function MobileStoriesViewer(props: StoriesViewerProps = {}) {
  return <MobileStoriesViewerComponent {...props} />;
}

export default MobileStoriesViewer;
