export type MoneyPlatformInviteBody = {
  type: "invite_registered";
  edgeId: string;
  inviterPlatformUserId: string;
  referralCodeId: string;
  inviteePlatformUserId?: string;
};

export type MoneyPlatformChatMilestoneBody = {
  type: "chat_messages_milestone";
  edgeId: string;
  platformUserId: string;
  chatId: string;
  blockIndex: number;
};

export type MoneyPlatformVideoCallMilestoneBody = {
  type: "video_call_minutes_milestone";
  edgeId: string;
  platformUserId: string;
  chatId: string;
  blockIndex: number;
};

export type MoneyPlatformPostCreatedMilestoneBody = {
  type: "post_created_milestone";
  edgeId: string;
  platformUserId: string;
  blockIndex: number;
};

export type MoneyPlatformProfileLikesMilestoneBody = {
  type: "profile_likes_received_milestone";
  edgeId: string;
  platformUserId: string;
  blockIndex: number;
};

export type MoneyPlatformEventBody =
  | MoneyPlatformInviteBody
  | MoneyPlatformChatMilestoneBody
  | MoneyPlatformVideoCallMilestoneBody
  | MoneyPlatformPostCreatedMilestoneBody
  | MoneyPlatformProfileLikesMilestoneBody;

export function parseMoneyPlatformEventBody(raw: unknown): MoneyPlatformEventBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const t = o.type;
  if (t === "chat_messages_milestone") {
    const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
    const platformUserId = typeof o.platformUserId === "string" ? o.platformUserId.trim() : "";
    const chatId = typeof o.chatId === "string" ? o.chatId.trim() : "";
    const blockIndex = Number(o.blockIndex);
    if (!edgeId || !platformUserId || !chatId || !Number.isFinite(blockIndex) || blockIndex < 1) return null;
    return {
      type: "chat_messages_milestone",
      edgeId,
      platformUserId,
      chatId,
      blockIndex: Math.floor(blockIndex),
    };
  }
  if (t === "video_call_minutes_milestone") {
    const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
    const platformUserId = typeof o.platformUserId === "string" ? o.platformUserId.trim() : "";
    const chatId = typeof o.chatId === "string" ? o.chatId.trim() : "";
    const blockIndex = Number(o.blockIndex);
    if (!edgeId || !platformUserId || !chatId || !Number.isFinite(blockIndex) || blockIndex < 1) return null;
    return {
      type: "video_call_minutes_milestone",
      edgeId,
      platformUserId,
      chatId,
      blockIndex: Math.floor(blockIndex),
    };
  }
  if (t === "post_created_milestone") {
    const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
    const platformUserId = typeof o.platformUserId === "string" ? o.platformUserId.trim() : "";
    const blockIndex = Number(o.blockIndex);
    if (!edgeId || !platformUserId || !Number.isFinite(blockIndex) || blockIndex < 1) return null;
    return {
      type: "post_created_milestone",
      edgeId,
      platformUserId,
      blockIndex: Math.floor(blockIndex),
    };
  }
  if (t === "profile_likes_received_milestone") {
    const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
    const platformUserId = typeof o.platformUserId === "string" ? o.platformUserId.trim() : "";
    const blockIndex = Number(o.blockIndex);
    if (!edgeId || !platformUserId || !Number.isFinite(blockIndex) || blockIndex < 1) return null;
    return {
      type: "profile_likes_received_milestone",
      edgeId,
      platformUserId,
      blockIndex: Math.floor(blockIndex),
    };
  }
  if (t !== "invite_registered") return null;
  const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
  const inviterPlatformUserId =
    typeof o.inviterPlatformUserId === "string" ? o.inviterPlatformUserId.trim() : "";
  const referralCodeId = typeof o.referralCodeId === "string" ? o.referralCodeId.trim() : "";
  if (!edgeId || !inviterPlatformUserId || !referralCodeId) return null;
  const inviteePlatformUserId =
    typeof o.inviteePlatformUserId === "string" ? o.inviteePlatformUserId.trim() : undefined;
  return { type: "invite_registered", edgeId, inviterPlatformUserId, referralCodeId, inviteePlatformUserId };
}
