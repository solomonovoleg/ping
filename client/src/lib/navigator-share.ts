/**
 * Пользователь закрыл системный лист «Поделиться» (Web Share API).
 * Safari/iOS часто даёт DOMException AbortError или текст «Abort due to cancellation of share».
 */
export function isNavigatorShareCancelled(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === "object" && "name" in err) {
    const n = String((err as { name: string }).name);
    if (n === "AbortError") return true;
  }
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = msg.toLowerCase();
  if (m.includes("cancellation of share")) return true;
  if (m.includes("abort") && m.includes("cancel")) return true;
  return false;
}
