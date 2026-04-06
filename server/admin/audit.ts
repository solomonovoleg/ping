import { getDb } from "../db";
import { adminAuditLog } from "@shared/schema";

export type AuditAction =
  | "user.ban"
  | "user.unban"
  | "user.update"
  | "user.delete"
  | "user.ban_and_purge"
  | "user.role"
  | "message.delete"
  | "chat.delete"
  | "parser.config.update"
  | "parser.run"
  | "vk_parser.binding.create"
  | "vk_parser.binding.update"
  | "vk_parser.binding.delete"
  | "vk_parser.binding.run"
  | "vk_parser.run_all"
  | "vk_parser.item.approve"
  | "vk_parser.item.reject"
  | "ops.platform.update"
  | "ops.report.resolve"
  | "ops.report.dismiss"
  | "ops.content.post.delete"
  | "ops.content.story.delete"
  | "ops.content.message.delete"
  | "ops.content.comment.delete"
  | "media_studio.synthetic_user.create"
  | "media_studio.synthetic_user.update"
  | "media_studio.synthetic_user.avatar"
  | "media_studio.synthetic_user.cover"
  | "media_studio.campaign.create"
  | "media_studio.campaign.update"
  | "media_studio.campaign.post.add"
  | "media_studio.campaign.post.delete"
  | "media_studio.campaign.tick"
  | "media_studio.campaign.tick_all"
  | "admin.group_chat.create"
  | "admin.group_chat.avatar"
  | "business_status.approve"
  | "business_status.reject"
  | "business_status.revision";

export async function writeAuditLog(params: {
  adminId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(adminAuditLog).values({
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details ?? null,
      ip: params.ip,
    });
  } catch {
    // No DB or schema not migrated — skip audit
  }
}
