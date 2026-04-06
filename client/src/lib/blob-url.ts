/**
 * WebKit (Safari) часто логирует WebKitBlobResource error 1, если revokeObjectURL
 * вызван сразу при смене src / размонтировании, пока движок ещё держит ресурс.
 */
export function scheduleRevokeObjectURL(url: string | null | undefined, delayMs = 450): void {
  if (!url || !url.startsWith("blob:")) return;
  const u = url;
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
  }, delayMs);
}
