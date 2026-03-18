"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";

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

export type UserAvatarProps = {
  /** URL картинки аватара; если нет — показывается векторный аватар по умолчанию */
  avatarUrl?: string | null;
  /** Имя для буквы (имя, фамилия или ID) */
  displayName?: string | null;
  /** Уникальный id для стабильного цвета (например userId или publicId) */
  seed?: string;
  size?: number;
  className?: string;
  /** Показать зелёную точку «онлайн» (lastSeenAt в пределах 2 минут) */
  showOnlineIndicator?: boolean;
  /** ISO дата последней активности; используется только при showOnlineIndicator */
  lastSeenAt?: string | null;
};

/**
 * Аватар пользователя: фото по ссылке или векторный аватар (буква + градиент)
 * в стиле логотипа PING для пользователей без загруженного аватара.
 */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function UserAvatar({
  avatarUrl,
  displayName,
  seed,
  size = 40,
  className,
  showOnlineIndicator = false,
  lastSeenAt,
}: UserAvatarProps) {
  const initial = displayName
    ? String(displayName).trim().slice(0, 1).toUpperCase() || "?"
    : "?";
  const colorSeed = seed ?? displayName ?? "default";
  const { bg, text } = getColorForSeed(colorSeed);

  const [imageError, setImageError] = useState(false);
  const resolvedUrl = avatarUrl?.trim() ? resolveUrl(avatarUrl.trim()) : "";
  useEffect(() => setImageError(false), [resolvedUrl]);
  const showImage = resolvedUrl && !imageError;

  const isOnline =
    showOnlineIndicator &&
    !!lastSeenAt &&
    Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;

  const dotSize = Math.max(6, size * 0.22);
  const wrapper = (child: React.ReactNode) =>
    showOnlineIndicator ? (
      <div className={cn("relative inline-flex flex-shrink-0", className)} style={{ width: size, height: size }}>
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

  if (showImage) {
    return wrapper(
      <img
        src={resolvedUrl}
        alt=""
        className={cn("rounded-full object-cover flex-shrink-0", !showOnlineIndicator && className)}
        style={{ width: size, height: size }}
        onError={() => setImageError(true)}
      />
    );
  }

  return wrapper(
    <div
      className={cn("rounded-full flex items-center justify-center flex-shrink-0 font-semibold", !showOnlineIndicator && className)}
      style={{
        width: size,
        height: size,
        background: bg,
        color: text,
        fontSize: Math.max(12, size * 0.45),
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
