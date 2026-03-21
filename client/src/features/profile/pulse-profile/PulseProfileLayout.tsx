import { useEffect, useState, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import {
  ChevronLeft,
  ChevronDown,
  MoreVertical,
  Plus,
  Grid3x3,
  Bookmark,
  Share2,
  Edit3,
  BarChart2,
  Tag,
  List,
  Link,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import {
  PulseProfileThemeProvider,
  usePulseProfileTheme,
  PULSE_IG_GLOW,
  PULSE_IG_GRAD,
} from "./pulse-profile-theme";
import { usePulseProfileThemeFromDocument } from "./usePulseProfileThemeFromDocument";

export type PulseProfileTabKey = "posts" | "saved" | "tagged";

/** Отступ контента над глобальной нижней навигацией `AppLayout` */
export const PULSE_PROFILE_NAV_CONTENT_PB = "var(--uix-nav-bottom)";

/** Крупный сквиркл-аватар как в макете PULSE (было 80px — визуально мелковато на телефоне). */
const PULSE_AVATAR_PX = 104;
const PULSE_COVER_H_PX = 156;
/** Насколько аватар заходит на блок с именем (нижний край обложки + offset). */
const PULSE_AVATAR_BOTTOM = -52;
/** Отступ контента под обложкой: перекрытие аватара + воздух до имени. */
const PULSE_BODY_PADDING_TOP = 62;
const PULSE_AVATAR_SQUIRCLE_RX = 24;
/** Для `UserAvatar` внутри кнопки (поле под 2px обводку). */
export const PULSE_PROFILE_AVATAR_INNER_PX = Math.round(PULSE_AVATAR_PX * 0.94);
export const PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX = Math.round(PULSE_AVATAR_SQUIRCLE_RX * 0.88);

const TEMPLATE_HIGHLIGHTS = [
  { label: "AMG", emoji: "🏎", hasContent: true as const },
  { label: "Работа", emoji: "💼", hasContent: true as const },
  { label: "Путешествия", emoji: "✈️", hasContent: true as const },
];

function PulseProfileMutualFollowers() {
  const { th } = usePulseProfileTheme();
  const avatars = [
    { label: "АК", color: "#818cf8" },
    { label: "МД", color: "#fb7185" },
    { label: "ИВ", color: "#22d3ee" },
  ];
  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      <div className="flex items-center">
        {avatars.map((a, i) => (
          <div
            key={a.label}
            className="flex items-center justify-center rounded-full font-black"
            style={{
              width: 20,
              height: 20,
              fontSize: 7,
              color: "white",
              background: a.color,
              border: `1.5px solid ${th.bg}`,
              marginLeft: i > 0 ? -7 : 0,
              zIndex: 3 - i,
              position: "relative",
            }}
          >
            {a.label}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: th.textFaint, fontWeight: 500 }}>3 общих подписчика</span>
    </div>
  );
}

function StoryRing({ size = PULSE_AVATAR_PX }: { size?: number }) {
  const { th } = usePulseProfileTheme();
  const r = size * 0.22;
  return (
    <>
      <div
        className="absolute"
        style={{
          inset: -3,
          zIndex: 1,
          borderRadius: r + 3,
          background: PULSE_IG_GRAD,
          boxShadow: PULSE_IG_GLOW,
        }}
      />
      <div
        className="absolute"
        style={{ inset: -1, zIndex: 2, borderRadius: r + 1, background: th.gapRing }}
      />
    </>
  );
}

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return count;
}

function StatCounter({ target, label, onClick }: { target: number; label: string; onClick?: () => void }) {
  const { th } = usePulseProfileTheme();
  const count = useCountUp(target, 850);
  const inner = (
    <>
      <span
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: th.text,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {count}
      </span>
      <span style={{ fontSize: 10, color: th.textFaint, fontWeight: 500, marginTop: 2 }}>{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center py-3 flex-1 min-w-0 cursor-pointer active:opacity-90"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex flex-col items-center py-3 flex-1 min-w-0 pointer-events-none">{inner}</div>;
}

export type PulseProfileLayoutProps = {
  /** Контейнер прокрутки (например ref из PullToRefresh) */
  scrollRef: RefObject<HTMLDivElement | null>;

  coverUrl: string | null;
  onCoverError: () => void;

  onBack: () => void;
  onMore: () => void;
  usernamePill: string;

  displayName: string;
  showVerified: boolean;
  idChip: string;
  genderChip: string | null;
  birthChip: string | null;

  bio: string | null;
  linkDisplay: string | null;
  linkHref: string | null;

  postsCount: number;
  followersCount: number;
  followingCount: number;
  onFollowersClick: () => void;
  onFollowingClick: () => void;
  onPostsStatClick?: () => void;

  /** Кнопки под статистикой: своя строка для «я» / «чужой» */
  actionRow: ReactNode;

  /** «Новое» в блоке ЗАКРЕПЛЁННОЕ (как в макете); без колбэка — плитка без действия */
  onHighlightNew?: () => void;

  /** Строка «3 общих подписчика» как в шаблоне */
  showMutualFollowers?: boolean;

  activeTab: PulseProfileTabKey;
  onTabChange: (t: PulseProfileTabKey) => void;
  postView: "list" | "grid";
  onTogglePostView: () => void;

  addContentStrip: ReactNode | null;

  postsContent: ReactNode;

  avatarInner: ReactNode;
  hasStoryGradient: boolean;
  onAvatarPress: () => void;
  onAvatarPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerLeave?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarPointerCancel?: (e: PointerEvent<HTMLButtonElement>) => void;
  onAvatarContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
  showAvatarPlus: boolean;
  onAvatarPlusClick: () => void;
  avatarMenuOpen: boolean;
  onAvatarMenuOpenChange: (open: boolean) => void;
  avatarMenuItems: { emoji: string; label: string; onClick: () => void }[];
};

function PulseProfileLayoutInner(props: PulseProfileLayoutProps) {
  const {
    scrollRef,
    coverUrl,
    onCoverError,
    onBack,
    onMore,
    usernamePill,
    displayName,
    showVerified,
    idChip,
    genderChip,
    birthChip,
    bio,
    linkDisplay,
    linkHref,
    postsCount,
    followersCount,
    followingCount,
    onFollowersClick,
    onFollowingClick,
    onPostsStatClick,
    actionRow,
    onHighlightNew,
    showMutualFollowers = true,
    activeTab,
    onTabChange,
    postView,
    onTogglePostView,
    addContentStrip,
    postsContent,
    avatarInner,
    hasStoryGradient,
    onAvatarPress,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerLeave,
    onAvatarPointerCancel,
    onAvatarContextMenu,
    showAvatarPlus,
    onAvatarPlusClick,
    avatarMenuOpen,
    onAvatarMenuOpenChange,
    avatarMenuItems,
  } = props;

  const { th, isDark } = usePulseProfileTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fn = () => setScrollY(el.scrollTop);
    el.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => el.removeEventListener("scroll", fn);
  }, [scrollRef]);

  return (
    <div
      className="relative isolate z-0 w-full min-h-full flex-1 select-none"
      style={{
        background: th.bg,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        color: th.text,
        paddingBottom: "var(--uix-space-4, 16px)",
      }}
    >
      <style>{`
        @keyframes pulse-profile-avatar-float {
          0%, 100% { transform: translateX(0px); }
          33% { transform: translateX(2.5px); }
          66% { transform: translateX(-2px); }
        }
      `}</style>

      <div style={{ paddingBottom: PULSE_PROFILE_NAV_CONTENT_PB }}>
        <div className="relative" style={{ height: 133 }}>
          <div className="absolute inset-0 overflow-hidden">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt=""
                className="absolute w-full"
                style={{
                  objectFit: "cover",
                  objectPosition: "center 30%",
                  height: "calc(100% + 56px)",
                  top: -28,
                  transform: `translateY(${Math.min(scrollY * 0.38, 28)}px)`,
                  willChange: "transform",
                }}
                onError={onCoverError}
              />
            ) : (
              <div
                className="absolute w-full"
                style={{
                  height: "calc(100% + 56px)",
                  top: -28,
                  transform: `translateY(${Math.min(scrollY * 0.38, 28)}px)`,
                  willChange: "transform",
                  background: isDark
                    ? `radial-gradient(ellipse 80% 120% at 50% 20%, ${th.accent}35 0%, #0a0a18 55%)`
                    : `radial-gradient(ellipse 80% 120% at 50% 20%, ${th.accent}28 0%, #e8ecfb 55%)`,
                }}
              />
            )}
            <div
              className="absolute top-0 left-0 right-0"
              style={{
                height: "70%",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.22) 55%, transparent 100%)",
              }}
            />
            <div
              className="absolute top-0 left-0 right-0"
              style={{ height: 48, background: "linear-gradient(to bottom, rgba(255,255,255,0.06) 0%, transparent 100%)" }}
            />
          </div>

          <div
            className="absolute left-0 right-0 flex justify-center z-20 pointer-events-none"
            style={{ top: "max(10px, env(safe-area-inset-top, 0px))" }}
          >
            <div
              className="flex items-center gap-1 px-3.5 py-1 rounded-full pointer-events-none"
              style={{
                background: "rgba(0,0,0,0.58)",
                backdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
              }}
            >
              <AtSign style={{ width: 11, height: 11, color: "rgba(255,255,255,0.55)" }} aria-hidden />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.82)",
                  letterSpacing: "0.01em",
                }}
              >
                {usernamePill}
              </span>
              <ChevronDown style={{ width: 12, height: 12, color: "rgba(255,255,255,0.45)" }} aria-hidden />
            </div>
          </div>

          <div
            className="absolute left-0 right-0 flex items-center justify-between px-4 z-20"
            style={{ top: "max(44px, calc(env(safe-area-inset-top, 0px) + 36px))" }}
          >
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Назад"
            >
              <ChevronLeft style={{ width: 22, height: 22, color: "rgba(255,255,255,0.9)" }} />
            </button>
            <button
              type="button"
              onClick={onMore}
              className="w-10 h-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Ещё"
            >
              <MoreVertical style={{ width: 20, height: 20, color: "rgba(255,255,255,0.9)" }} />
            </button>
          </div>

          <div className="absolute left-4 z-20" style={{ bottom: PULSE_AVATAR_BOTTOM }}>
            <div
              className="relative"
              style={{
                width: PULSE_AVATAR_PX,
                height: PULSE_AVATAR_PX,
                animation: reducedMotion ? undefined : "pulse-profile-avatar-float 4s ease-in-out infinite",
              }}
            >
              {hasStoryGradient ? <StoryRing size={PULSE_AVATAR_PX} /> : null}
              <button
                type="button"
                onClick={onAvatarPress}
                onPointerDown={onAvatarPointerDown}
                onPointerUp={onAvatarPointerUp}
                onPointerLeave={onAvatarPointerLeave}
                onPointerCancel={onAvatarPointerCancel}
                onContextMenu={onAvatarContextMenu}
                className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden transition-transform active:scale-95"
                style={{
                  borderRadius: PULSE_AVATAR_SQUIRCLE_RX,
                  background: isDark
                    ? "linear-gradient(145deg,#1a1040,#0c0820)"
                    : "linear-gradient(145deg,#d8d4f8,#eef1fb)",
                  border: `2px solid ${isDark ? `${th.accent}38` : `${th.accent}2e`}`,
                  color: th.accent,
                }}
                aria-label="Аватар и сториз"
              >
                {avatarInner}
              </button>
              {showAvatarPlus ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAvatarPlusClick();
                  }}
                  className="absolute z-30 flex items-center justify-center rounded-full transition-all active:scale-90 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                  style={{
                    width: 26,
                    height: 26,
                    bottom: 2,
                    right: 2,
                    background: th.accent,
                    border: `2px solid ${th.bg}`,
                    boxShadow: `0 2px 10px ${th.accent}66`,
                  }}
                  aria-label="Меню аватара"
                >
                  <Plus style={{ width: 14, height: 14, color: "white", strokeWidth: 2.5 }} />
                </button>
              ) : null}

              {avatarMenuOpen ? (
                <div
                  className="absolute z-50 rounded-2xl overflow-hidden"
                  style={{
                    top: PULSE_AVATAR_PX + 8,
                    left: 0,
                    width: 200,
                    background: isDark ? "rgba(16,16,28,0.96)" : "rgba(250,250,255,0.97)",
                    backdropFilter: "blur(24px)",
                    border: `1px solid ${th.borderStrong}`,
                    boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.7)" : "0 8px 32px rgba(99,102,241,0.12)",
                  }}
                  role="menu"
                >
                  {avatarMenuItems.map((item, i, arr) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onAvatarMenuOpenChange(false);
                        item.onClick();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-opacity active:opacity-80"
                      style={{
                        borderBottom: i < arr.length - 1 ? `1px solid ${th.border}` : "none",
                      }}
                    >
                      <span style={{ fontSize: 16 }} aria-hidden>
                        {item.emoji}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: th.text }}>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-4" style={{ paddingTop: PULSE_BODY_PADDING_TOP }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1
                  style={{
                    fontSize: 21,
                    fontWeight: 800,
                    color: th.text,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  {displayName}
                </h1>
                {showVerified ? (
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ width: 17, height: 17, background: th.accent, marginTop: 2 }}
                    aria-label="Подтверждённый профиль"
                  >
                    <span style={{ fontSize: 9, color: "white", fontWeight: 800 }}>✓</span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: th.accentDim, border: `1px solid ${th.accentBorder}` }}
                >
                  <span style={{ fontSize: 11, color: th.accent, fontWeight: 600 }}>{idChip}</span>
                </div>
                {genderChip ? (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: th.chipBg, border: `1px solid ${th.chipBorder}` }}
                  >
                    <span style={{ fontSize: 11, color: th.textSub }}>{genderChip}</span>
                  </div>
                ) : null}
                {birthChip ? (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: th.chipBg, border: `1px solid ${th.chipBorder}` }}
                  >
                    <span style={{ fontSize: 11, color: th.textSub }}>🎂 {birthChip}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {showMutualFollowers ? <PulseProfileMutualFollowers /> : null}

          {bio ? (
            <p style={{ fontSize: 13.5, color: th.textSub, lineHeight: 1.5, marginTop: 10 }}>{bio}</p>
          ) : null}
          {linkDisplay && linkHref ? (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 mt-1.5 break-all"
            >
              <Link style={{ width: 11, height: 11, color: th.accent, flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 12, color: th.accent, fontWeight: 500 }}>{linkDisplay}</span>
            </a>
          ) : null}

          <div
            className="flex mt-4 rounded-2xl overflow-hidden"
            style={{ background: th.statsBg, border: `1px solid ${th.statsBorder}` }}
          >
            <div style={{ flex: 1, borderRight: `1px solid ${th.statsBorder}` }}>
              <StatCounter target={postsCount} label="Публикации" onClick={onPostsStatClick} />
            </div>
            <div style={{ flex: 1, borderRight: `1px solid ${th.statsBorder}` }}>
              <StatCounter target={followersCount} label="Подписчики" onClick={onFollowersClick} />
            </div>
            <div style={{ flex: 1 }}>
              <StatCounter target={followingCount} label="Подписки" onClick={onFollowingClick} />
            </div>
          </div>

          <div className="mt-3.5">{actionRow}</div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between px-4 mb-3">
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: th.sideLabel,
                letterSpacing: "0.06em",
              }}
            >
              ЗАКРЕПЛЁННОЕ
            </span>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-1">
            {TEMPLATE_HIGHLIGHTS.map((h) => (
              <PulseProfileHighlightTile key={h.label} label={h.label} emoji={h.emoji} hasContent={h.hasContent} />
            ))}
            <PulseProfileHighlightTile
              label="Новое"
              emoji=""
              hasContent={false}
              onClick={onHighlightNew}
            />
          </div>
        </div>

        <div className="flex items-center mt-5 px-4 gap-1.5">
          <div className="flex gap-1.5 flex-1 min-w-0 flex-wrap">
            {(
              [
                { key: "posts" as const, Icon: Grid3x3, label: "Посты" },
                { key: "saved" as const, Icon: Bookmark, label: "Сохранено" },
                { key: "tagged" as const, Icon: Tag, label: "Отметки" },
              ] as const
            ).map(({ key, Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all min-h-[var(--uix-touch-min)]"
                style={
                  activeTab === key
                    ? { background: th.tabActive, border: `1px solid ${th.tabBorder}`, color: th.accent }
                    : { background: "transparent", border: "1px solid transparent", color: th.textFaint }
                }
              >
                <Icon style={{ width: 13, height: 13 }} aria-hidden />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
          {activeTab === "posts" ? (
            <button
              type="button"
              onClick={onTogglePostView}
              className="flex items-center justify-center rounded-xl transition-all active:scale-90 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
              style={{
                width: 34,
                height: 34,
                background: postView === "grid" ? th.tabActive : "transparent",
                border: `1px solid ${postView === "grid" ? th.tabBorder : th.border}`,
              }}
              aria-label={postView === "grid" ? "Показать списком" : "Показать сеткой"}
            >
              {postView === "grid" ? (
                <List style={{ width: 14, height: 14, color: th.accent }} />
              ) : (
                <Grid3x3 style={{ width: 14, height: 14, color: th.textFaint }} />
              )}
            </button>
          ) : null}
        </div>

        {addContentStrip ? <div className="mx-4 mt-4 mb-1">{addContentStrip}</div> : null}

        <div className="mt-3" style={{ borderTop: `1px solid ${th.postBorder}` }}>
          {postsContent}
        </div>
      </div>

    </div>
  );
}

/** Плитка «ЗАКРЕПЛЁННОЕ» как в `pulse-profile-export`. */
export function PulseProfileHighlightTile({
  label,
  emoji,
  hasContent,
  onClick,
  children,
}: {
  label: string;
  emoji: string;
  hasContent: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const { th, isDark } = usePulseProfileTheme();
  const body = (
    <div
      className="relative rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        width: 60,
        height: 60,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
        border: `1.5px solid ${th.border}`,
      }}
    >
      {hasContent ? (
        (children ?? <span style={{ fontSize: 26 }}>{emoji}</span>)
      ) : (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${th.accent}20`, border: `1.5px dashed ${th.accent}60` }}
        >
          <Plus style={{ width: 15, height: 15, color: th.accent }} />
        </div>
      )}
    </div>
  );
  const caption = (
    <span style={{ fontSize: 10, color: th.textSub, fontWeight: 500 }}>{label || "Новое"}</span>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 min-w-[4rem] shrink-0">
        {body}
        {caption}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[4rem] shrink-0">
      {body}
      {caption}
    </div>
  );
}

/** Кнопка «Добавить контент» под вкладками (макет PULSE). */
export function PulseProfileAddContentStrip({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 rounded-2xl relative overflow-hidden transition-all active:scale-[0.98] disabled:opacity-60 min-h-[var(--uix-touch-min)]"
      style={{
        height: 50,
        border: `1.5px dashed ${th.accent}59`,
        background: isDark
          ? `linear-gradient(120deg, ${th.accent}1c 0%, rgba(196,132,252,0.07) 50%, rgba(56,189,248,0.08) 100%)`
          : `linear-gradient(120deg, ${th.accent}14 0%, rgba(196,132,252,0.05) 50%, rgba(56,189,248,0.06) 100%)`,
        backdropFilter: "blur(14px)",
        boxShadow: isDark
          ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px ${th.accent}1f`
          : `inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 8px ${th.accent}14`,
      }}
      aria-label="Добавить контент"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 55%)" }}
      />
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
        style={{
          background: `linear-gradient(135deg,${th.accent},${th.accent}bb)`,
          boxShadow: `0 2px 8px ${th.accent}73`,
        }}
      >
        <Plus style={{ width: 17, height: 17, color: "white", strokeWidth: 2.5 }} />
      </div>
      <span
        className="relative z-10"
        style={{ fontSize: 14, fontWeight: 700, color: th.accent, letterSpacing: "-0.01em" }}
      >
        Добавить контент
      </span>
      <div className="ml-auto relative z-10 w-1.5 h-1.5 rounded-full" style={{ background: th.accent, opacity: 0.5 }} />
    </button>
  );
}

/** Оболочка профиля PULSE (экспорт `pulse-profile-export` / MobileProfile), без нижней навигации приложения. */
export function PulseProfileLayout(props: PulseProfileLayoutProps) {
  const theme = usePulseProfileThemeFromDocument();
  return (
    <PulseProfileThemeProvider theme={theme}>
      <PulseProfileLayoutInner {...props} />
    </PulseProfileThemeProvider>
  );
}

/** Для кнопок «Редактировать / аналитика / поделиться» в стиле макета */
export function PulseProfileIconButton({
  icon: Icon,
  label,
  onClick,
  variant = "surface",
  className,
}: {
  icon: typeof Edit3;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "surface";
  className?: string;
}) {
  const { th } = usePulseProfileTheme();
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-center rounded-2xl transition-all active:scale-[0.97] min-h-[var(--uix-touch-min)]",
        primary ? "flex-1 gap-2 px-3" : "w-11 shrink-0",
        className
      )}
      style={{
        height: 40,
        background: primary
          ? `linear-gradient(135deg, ${th.accent} 0%, #7c3aed 52%, #a855f7 100%)`
          : th.surface,
        border: primary ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${th.border}`,
        boxShadow: primary ? `0 4px 18px ${th.accent}55, inset 0 1px 0 rgba(255,255,255,0.12)` : undefined,
      }}
      aria-label={label}
    >
      <Icon
        style={{
          width: primary ? 13 : 15,
          height: primary ? 13 : 15,
          color: primary ? "rgba(255,255,255,0.95)" : th.textSub,
        }}
      />
      {primary ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.98)" }}>{label}</span>
      ) : null}
    </button>
  );
}
