import { API, apiFetch } from "@/lib/api-base";

export async function adminSaveEdgeCompanionConfig(edgeId: string, companion: unknown): Promise<void> {
  const res = await apiFetch(`${API}/admin/edge/companion-config`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edgeId: edgeId.trim(), companion }),
  });
  if (!res.ok) {
    const t = (await res.text()) || res.statusText;
    throw new Error(t || `${res.status}`);
  }
}
