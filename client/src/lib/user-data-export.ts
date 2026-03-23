import { apiFetch, API } from "@/lib/api-base";

/** Скачать JSON со своими данными (сервер: GET /api/users/me/data-export). */
export async function downloadUserDataExportFile(): Promise<void> {
  const res = await apiFetch(`${API}/users/me/data-export`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Не удалось сформировать файл";
    try {
      const j = (await res.json()) as { message?: string };
      if (j?.message) message = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = "ping-data-export.json";
  const m = cd?.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
  const raw = m?.[1] || m?.[2];
  if (raw) {
    try {
      filename = decodeURIComponent(raw.replace(/^UTF-8''/i, ""));
    } catch {
      filename = raw;
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
