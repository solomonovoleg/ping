export async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text.trim()) return fallback;
    const j = JSON.parse(text) as { message?: string; error?: string };
    const m =
      (typeof j?.message === "string" && j.message.trim()) ? j.message.trim()
      : (typeof j?.error === "string" && j.error.trim()) ? j.error.trim()
      : "";
    return m || fallback;
  } catch {
    return fallback;
  }
}
