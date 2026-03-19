import type { AiMessageRow } from "./repository";

export type AiMessageDto = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export function toAiMessageDto(row: AiMessageRow): AiMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}
