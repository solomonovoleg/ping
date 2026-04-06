import { fetchUpstreamEdgeServicePath } from "./upstream-client";

export type InviteRegisteredEdgePayload = {
  edgeId: string;
  inviterPlatformUserId: string;
  referralCodeId: string;
  inviteePlatformUserId: string;
};

/**
 * Сообщает EDGE MONEY о регистрации по коду партии (секрет сервиса). Ошибки только в лог — регистрация уже прошла.
 */
export async function forwardMoneyInviteRegisteredToEdge(payload: InviteRegisteredEdgePayload): Promise<void> {
  const body = JSON.stringify({
    type: "invite_registered",
    edgeId: payload.edgeId.trim(),
    inviterPlatformUserId: payload.inviterPlatformUserId.trim(),
    referralCodeId: payload.referralCodeId.trim(),
    inviteePlatformUserId: payload.inviteePlatformUserId.trim(),
  });
  try {
    const up = await fetchUpstreamEdgeServicePath("/v1/money/platform-events", {
      method: "POST",
      body,
    });
    if (!up.ok || up.status < 200 || up.status >= 300) {
      console.warn("[forward-money-invite] EDGE unavailable or error", up.ok ? up.status : "no_upstream");
    }
  } catch (e) {
    console.error("[forward-money-invite]", e);
  }
}
