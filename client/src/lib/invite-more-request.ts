import { API, apiFetch } from "@/lib/api-base";

export type MyInviteMorePending = {
  id: string;
  message: string | null;
  createdAt: string;
} | null;

export async function getMyInviteMoreRequestStatus(): Promise<{ pending: MyInviteMorePending }> {
  const res = await apiFetch(`${API}/referrals/my-invite-more-request`, { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить статус заявки");
  return res.json();
}

export async function submitInviteMoreRequest(message?: string): Promise<{ id: string }> {
  const res = await apiFetch(`${API}/referrals/invite-more-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: message?.trim() || undefined }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
  if (!res.ok) throw new Error(data.message || "Не удалось отправить заявку");
  return { id: String(data.id ?? "") };
}
