type ChatRouteInput = {
  id?: unknown;
  type?: unknown;
  shortCode?: unknown;
  otherMember?: { publicId?: unknown } | null;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asPositiveIntegerString(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return String(Math.trunc(v));
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : "";
  }
  return "";
}

/**
 * Canonical chat URL:
 * - DM: /chat/:otherMemberPublicId
 * - group/business: /chat/:shortCode
 * - fallback: /chat/:uuid
 */
export function buildChatPath(chat: ChatRouteInput, fallbackChatId?: unknown): string {
  const dmPublicId = asPositiveIntegerString(chat.otherMember?.publicId);
  if (asString(chat.type) === "dm" && dmPublicId) {
    return `/chat/${encodeURIComponent(dmPublicId)}`;
  }

  const shortCode = asString(chat.shortCode).toLowerCase();
  if (shortCode) {
    return `/chat/${encodeURIComponent(shortCode)}`;
  }

  const id = asString(chat.id) || asString(fallbackChatId);
  return id ? `/chat/${encodeURIComponent(id)}` : "/chats";
}
