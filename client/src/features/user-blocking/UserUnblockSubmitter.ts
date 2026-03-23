import { API, apiFetch } from "@/lib/api-base";

export class UserUnblockSubmitter {
  static async submit(targetUserId: string): Promise<void> {
    const res = await apiFetch(`${API}/users/${encodeURIComponent(targetUserId)}/block`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? "Не удалось снять блокировку");
    }
  }
}
