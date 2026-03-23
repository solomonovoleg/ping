import { getDb } from "../db";
import { adminAuditLog } from "@shared/schema";

export type AuditAction =
  | "user.ban"
  | "user.unban"
  | "user.update"
  | "user.delete"
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
  | "ops.report.dismiss";

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
