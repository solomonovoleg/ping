/** Частичное обновление метаданных чата без лишних колонок в `set`. */
export function buildChatMetadataUpdatePatch(data: {
  name?: string;
  avatarUrl?: string;
  shortCode?: string | null;
  inviteCode?: string | null;
  dmMultilingualEnabled?: boolean;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
  if (data.shortCode !== undefined) updates.shortCode = data.shortCode;
  if (data.inviteCode !== undefined) updates.inviteCode = data.inviteCode;
  if (data.dmMultilingualEnabled !== undefined) updates.dmMultilingualEnabled = data.dmMultilingualEnabled;
  return updates;
}
