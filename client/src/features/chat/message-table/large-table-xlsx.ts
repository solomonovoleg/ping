import { CHAT_FILE_XLSX_MIME } from "@/features/chat/utils/chat-file-payload";
import { MESSAGE_TABLE_MAX_CSV_BYTES } from "./constants";
import type { ParsedGrid } from "./types";

/**
 * Сборка .xlsx из сетки (динамический import `xlsx`, не в initial bundle).
 * Лицензия: пакет `xlsx` на npm — community-редакция SheetJS; для коммерческого
 * продукта свериться с https://sheetjs.com/license/ и при необходимости взять лицензию у вендора.
 */
export async function buildLargeTableXlsxFileFromGrid(grid: ParsedGrid): Promise<File> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(grid.rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Таблица");
  const raw = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
  if (u8.byteLength > MESSAGE_TABLE_MAX_CSV_BYTES) {
    throw new Error(
      "Файл Excel получился слишком большим (лимит ~10 МБ). Попробуй CSV или разбей таблицу.",
    );
  }
  const blob = new Blob([u8], { type: CHAT_FILE_XLSX_MIME });
  return new File([blob], `table-${Date.now()}.xlsx`, { type: CHAT_FILE_XLSX_MIME });
}
