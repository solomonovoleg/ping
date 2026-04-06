export function deriveVideoNotePosterUrl(content: string | null | undefined): string | null {
  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw) return null;
  try {
    if (raw.startsWith("/")) {
      const m = raw.match(/(\.[^./?#]+)$/);
      if (!m) return null;
      return `${raw.slice(0, -m[1].length)}.poster.jpg`;
    }
    const url = new URL(raw);
    const pathname = url.pathname;
    const idx = pathname.lastIndexOf(".");
    if (idx <= pathname.lastIndexOf("/")) return null;
    url.pathname = `${pathname.slice(0, idx)}.poster.jpg`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
