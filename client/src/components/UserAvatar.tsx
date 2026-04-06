"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useSeamlessVideoLoop } from "@/lib/reels-video";
import { avatarVideoPosterUrl } from "@/lib/avatar-video-poster";

/** Палитра в стиле логотипа PING: синие и нейтральные тона */
const AVATAR_COLORS = [
  { bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", text: "#fff" },
  { bg: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)", text: "#fff" },
  { bg: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", text: "#fff" },
  { bg: "linear-gradient(135deg, #64748b 0%, #475569 100%)", text: "#fff" },
  { bg: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)", text: "#fff" },
  { bg: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)", text: "#fff" },
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getColorForSeed(seed: string) {
  const idx = hashSeed(seed) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function isVideoAvatarUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export type UserAvatarProps = {
  /** URL картинки аватара; если нет — показывается векторный аватар по умолчанию */
  avatarUrl?: string | null;
  /**
   * Явный URL постера для видео-аватара (JPEG). Если не задан — берётся тот же путь, что у видео, с расширением .jpg
   * (так сервер кладёт кадр после транскода).
   */
  videoPosterUrl?: string | null;
  /** Имя для буквы (имя, фамилия или ID) */
  displayName?: string | null;
  /** Уникальный id для стабильного цвета (например userId или publicId) */
  seed?: string;
  size?: number;
  className?: string;
  /** Если задан — скругление в px вместо круга (сквиркл в профиле PULSE и т.п.). */
  cornerRadius?: number;
  /** Показать зелёную точку «онлайн» (lastSeenAt в пределах 2 минут) */
  showOnlineIndicator?: boolean;
  /** ISO дата последней активности; используется только при showOnlineIndicator */
  lastSeenAt?: string | null;
  /**
   * По умолчанию видео-аватар не прелоадит и не играет вне экрана (меньше нагрузка в длинных списках).
   * В превью/редакторе, где элемент гарантированно виден, можно выключить.
   */
  videoAlwaysActive?: boolean;
  /**
   * Когда аватар внутри кликабельной строки/кнопки: `<video>`/`<img>` на iOS часто перехватывают касание.
   * Включает `pointer-events-none`, событие получает родитель.
   */
  pointerEventsNone?: boolean;
};

/**
 * Аватар пользователя: фото/короткое видео по ссылке или векторный аватар (буква + градиент)
 * в стиле логотипа PING для пользователей без загруженного аватара.
 */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function UserAvatar({
  avatarUrl,
  videoPosterUrl,
  displayName,
  seed,
  size = 40,
  className,
  cornerRadius,
  showOnlineIndicator = false,
  lastSeenAt,
  videoAlwaysActive = false,
  pointerEventsNone = false,
}: UserAvatarProps) {
  const initial = displayName
    ? String(displayName).trim().slice(0, 1).toUpperCase() || "?"
    : "?";
  const colorSeed = seed ?? displayName ?? "default";
  const { bg, text } = getColorForSeed(colorSeed);

  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const resolvedUrl = avatarUrl?.trim() ? resolveUrl(avatarUrl.trim()) : "";
  const isVideo = resolvedUrl ? isVideoAvatarUrl(resolvedUrl) : false;
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoInView, setVideoInView] = useState(videoAlwaysActive);

  const showImage = resolvedUrl && !isVideo && !imageError;
  const showVideo = Boolean(resolvedUrl && isVideo && !videoError);

  useEffect(() => setImageError(false), [resolvedUrl]);
  useEffect(() => setVideoError(false), [resolvedUrl]);

  useEffect(() => {
    if (videoAlwaysActive) {
      setVideoInView(true);
      return;
    }
    const v = videoRef.current;
    if (!v || !showVideo) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) {
          setVideoInView(false);
          return;
        }
        const area = e.intersectionRect.width * e.intersectionRect.height;
        setVideoInView(e.isIntersecting && (e.intersectionRatio >= 0.15 || area >= 400));
      },
      // См. FeedInlineVideo: на iOS/WKWebView root = overflow-scroll ломает обновления при скролле.
      { root: null, rootMargin: "60px", threshold: [0, 0.15, 0.35, 0.6, 1] },
    );
    observer.observe(v);
    return () => observer.disconnect();
  }, [resolvedUrl, videoAlwaysActive, showVideo]);

  const derivedPoster =
    showVideo && resolvedUrl
      ? (videoPosterUrl?.trim() ? resolveUrl(videoPosterUrl.trim()) : avatarVideoPosterUrl(resolvedUrl))
      : undefined;
  const videoPoster = derivedPoster || undefined;

  const videoPreload =
    !showVideo || reducedMotion
      ? "metadata"
      : videoAlwaysActive
        ? size >= 48
          ? "auto"
          : "metadata"
        : videoInView
          ? size >= 48
            ? "auto"
            : "metadata"
          : "none";

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resolvedUrl || !isVideo || imageError || videoError) return;
    if (reducedMotion) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      return;
    }
    if (!videoAlwaysActive && !videoInView) {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    v.muted = true;
    v.defaultMuted = true;
    void v.play().catch(() => {});
  }, [resolvedUrl, isVideo, reducedMotion, imageError, videoError, videoInView, videoAlwaysActive]);

  const useSeamlessAvatarLoop = !reducedMotion && showVideo && (videoAlwaysActive || videoInView);
  useSeamlessVideoLoop(videoRef, { enabled: useSeamlessAvatarLoop, srcKey: resolvedUrl });

  const isOnline =
    showOnlineIndicator &&
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;

  const dotSize = Math.max(6, size * 0.22);
  const peNone = pointerEventsNone ? "pointer-events-none" : "";
  const wrapper = (child: React.ReactNode) =>
    showOnlineIndicator ? (
      <div
        className={cn("relative inline-flex flex-shrink-0", peNone, className)}
        style={{ width: size, height: size }}
      >
        {child}
        {isOnline && (
          <span
            className="absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-background"
            style={{ width: dotSize, height: dotSize }}
            aria-label="в сети"
          />
        )}
      </div>
    ) : (
      child
    );

  const radiusStyle = cornerRadius != null ? { borderRadius: cornerRadius } : undefined;
  const shapeClass = cornerRadius != null ? "object-cover flex-shrink-0" : "rounded-full object-cover flex-shrink-0";

  const ariaLabel = displayName ? `Аватар, ${displayName}` : "Аватар";

  if (showVideo) {
    return wrapper(
      <video
        ref={videoRef}
        src={resolvedUrl}
        poster={videoPoster}
        className={cn(shapeClass, peNone, !showOnlineIndicator && className)}
        style={{ width: size, height: size, ...radiusStyle }}
        autoPlay={!reducedMotion && (videoAlwaysActive || videoInView)}
        muted
        playsInline
        loop={!reducedMotion}
        preload={videoPreload}
        aria-label={ariaLabel}
        onError={() => setVideoError(true)}
      />
    );
  }

  if (showImage) {
    return wrapper(
      <img
        src={resolvedUrl}
        alt=""
        className={cn(shapeClass, peNone, !showOnlineIndicator && className)}
        style={{ width: size, height: size, ...radiusStyle }}
        onError={() => setImageError(true)}
      />
    );
  }

  return wrapper(
    <div
      className={cn(
        cornerRadius != null
          ? "flex items-center justify-center flex-shrink-0 font-semibold"
          : "rounded-full flex items-center justify-center flex-shrink-0 font-semibold",
        peNone,
        !showOnlineIndicator && className
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        color: text,
        fontSize: Math.max(12, size * 0.45),
        ...radiusStyle,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
