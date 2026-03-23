import { API, apiFetch } from "@/lib/api-base";
import type { UserBlockFlags } from "./types";
import { USER_BLOCK_NOTE_MAX } from "./types";

/** Отправка блокировки на API. */
export class UserBlockSubmitter {
  static async submit(targetUserId: string, flags: UserBlockFlags, note?: string | null): Promise<void> {
    const body: Record<string, unknown> = {
      restrictProfile: flags.restrictProfile,
      restrictChat: flags.restrictChat,
      restrictSocial: flags.restrictSocial,
    };
    if (note !== undefined && note !== null) {
      const t = note.trim();
      body.note = t.length === 0 ? null : t.slice(0, USER_BLOCK_NOTE_MAX);
    }
    const res = await apiFetch(`${API}/users/${encodeURIComponent(targetUserId)}/block`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? "Не удалось заблокировать");
    }
  }
}
