import { useState, useEffect } from "react";
import { View, Text, Image, ViewStyle } from "react-native";
import { resolveUrl } from "../lib/api";

/** Палитра как на вебе (PING): синие и нейтральные тона */
const AVATAR_COLORS = [
  { bg: "#3b82f6", text: "#fff" },
  { bg: "#0ea5e9", text: "#fff" },
  { bg: "#6366f1", text: "#fff" },
  { bg: "#64748b", text: "#fff" },
  { bg: "#0f766e", text: "#fff" },
  { bg: "#1e40af", text: "#fff" },
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
  avatarUrl?: string | null;
  displayName?: string | null;
  seed?: string;
  size?: number;
  style?: ViewStyle;
};

/**
 * Аватар как на вебе: фото по ссылке или буква с цветом по seed.
 */
export function UserAvatar({
  avatarUrl,
  displayName,
  seed,
  size = 40,
  style,
}: UserAvatarProps) {
  const initial = displayName
    ? String(displayName).trim().slice(0, 1).toUpperCase() || "?"
    : "?";
  const colorSeed = seed ?? displayName ?? "default";
  const { bg, text } = getColorForSeed(colorSeed);

  const resolvedUrl = avatarUrl?.trim() ? resolveUrl(avatarUrl.trim()) : null;
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    setImageError(false);
  }, [resolvedUrl]);
  const showImage = Boolean(resolvedUrl) && !imageError;

  if (showImage && resolvedUrl) {
    return (
      <Image
        source={{ uri: resolvedUrl }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: text,
          fontSize: Math.max(12, size * 0.45),
          fontWeight: "600",
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
