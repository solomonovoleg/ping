/**
 * UIX-GUIDELINES.md §2 — фиксированные цвета участников (PULSE 2040 Group Call).
 * Локальный участник всегда violet (#8b5cf6), остальным назначаются indigo → sky → emerald → amber по порядку.
 */
export const GROUP_CALL_LOCAL_ACCENT = {
  hex: "#8b5cf6",
  gradient: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)",
} as const

export const GROUP_CALL_PEER_ACCENTS = [
  { hex: "#6366f1", gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" },
  { hex: "#0ea5e9", gradient: "linear-gradient(135deg, #0c1a2e 0%, #0c4a6e 100%)" },
  { hex: "#10b981", gradient: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)" },
  { hex: "#f59e0b", gradient: "linear-gradient(135deg, #1c1400 0%, #451a03 100%)" },
] as const

export function groupCallAccentForUser(
  userId: string,
  myUserId: string,
  sortedPeerIds: readonly string[],
): { hex: string; gradient: string } {
  if (userId === myUserId) return GROUP_CALL_LOCAL_ACCENT
  const idx = sortedPeerIds.indexOf(userId)
  const i = idx >= 0 ? idx : 0
  return GROUP_CALL_PEER_ACCENTS[i % GROUP_CALL_PEER_ACCENTS.length]!
}
