export function normalizeMessageType(
  type: unknown,
):
  | "system"
  | "voice"
  | "image"
  | "video"
  | "video_note"
  | "sticker"
  | "file"
  | "text"
  | "post_share"
  | "comment_share"
  | "story_reply" {
  if (type === "system") return "system";
  if (type === "voice") return "voice";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (type === "video_note") return "video_note";
  if (type === "sticker") return "sticker";
  if (type === "file") return "file";
  if (type === "post_share") return "post_share";
  if (type === "comment_share") return "comment_share";
  if (type === "story_reply") return "story_reply";
  return "text";
}
