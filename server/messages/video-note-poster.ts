import path from "path";

export function deriveVideoNotePosterUrl(content: string | null | undefined): string | null {
  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw) return null;
  try {
    if (raw.startsWith("/")) {
      const ext = path.extname(raw);
      if (!ext) return null;
      return `${raw.slice(0, -ext.length)}.poster.jpg`;
    }
    const url = new URL(raw);
    const ext = path.extname(url.pathname);
    if (!ext) return null;
    url.pathname = `${url.pathname.slice(0, -ext.length)}.poster.jpg`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
