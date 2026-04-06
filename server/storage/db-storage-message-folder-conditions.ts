import { eq, isNull, type SQL } from "drizzle-orm";
import { messages } from "@shared/schema";

/** Сообщения основной папки (`folder_id IS NULL`) или указанной папки. */
export function messageFolderIdCondition(folderId: string | null | undefined): SQL {
  return folderId != null ? eq(messages.folderId, folderId) : isNull(messages.folderId);
}
