/** Регистрация: New-Tel call-password-id — пользователь звонит на confirmationNumber, вебхук подтверждает. */
import { randomUUID } from "crypto";
import {
  CHALLENGE_TTL_MS,
  VERIFIED_TICKET_TTL_MS,
  callNewTelPasswordApi,
  extractNewTelMethodError,
  normalizeDigitsPhone,
} from "./call-password-core";
import {
  deleteInboundPending,
  getInboundPending,
  setInboundPending,
} from "./call-password-id-pending";
import { logNewTelInternalVerificationEvent, newTelLogIds } from "./new-tel-internal-log";

type StartCallPasswordIdResponse = {
  status?: string;
  message?: string;
  data?: {
    result?: string;
    message?: string;
    callDetails?: {
      callId?: string;
      confirmationNumber?: string;
      qrCodeUri?: string;
      clientNumber?: string;
    };
  };
};

type VerifiedTicket = {
  token: string;
  phone: string;
  expiresAtMs: number;
};

const verifiedTickets = new Map<string, VerifiedTicket>();

function cleanupExpiredTickets(): void {
  const now = Date.now();
  for (const [token, ticket] of verifiedTickets.entries()) {
    if (ticket.expiresAtMs <= now) verifiedTickets.delete(token);
  }
}

export type StartPhoneInboundResult = {
  challengeId: string;
  expiresAt: string;
  confirmationNumber: string;
  qrCodeUri: string | null;
};

export async function startPhoneCallVerification(
  phone: string,
  webhookPublicBaseUrl: string,
): Promise<StartPhoneInboundResult> {
  const clientNumber = normalizeDigitsPhone(phone);
  const base = webhookPublicBaseUrl.replace(/\/+$/, "");
  const callbackLink = `${base}/api/auth/new-tel/callpassword-id/webhook`;
  const payload: Record<string, unknown> = {
    callbackLink,
    clientNumber,
    timeout: 120,
    userData: "signup",
  };

  const response = await callNewTelPasswordApi<StartCallPasswordIdResponse>(
    "call-password-id/start-waiting-mode-busy",
    payload,
    { scenario: "signup" },
  );
  const methodError = extractNewTelMethodError(response);
  if (methodError) throw new Error(methodError);

  const details = response.data?.callDetails;
  const callId = typeof details?.callId === "string" ? details.callId.trim() : "";
  const confirmationNumber =
    typeof details?.confirmationNumber === "string" ? details.confirmationNumber.trim() : "";
  if (!callId || !confirmationNumber) {
    const msg = "Не удалось начать подтверждение номера. Проверьте номер и попробуйте снова.";
    void logNewTelInternalVerificationEvent({
      scenario: "signup",
      code: "inbound_start_invalid",
      apiOk: false,
      message: msg,
      atoms: {
        hasCallId: Boolean(callId),
        hasConfirmation: Boolean(confirmationNumber),
        dataResult: response.data?.result ?? null,
        dataMessage: response.data?.message ?? null,
      },
    });
    throw new Error(msg);
  }

  setInboundPending(callId, phone, clientNumber, "signup");
  const qr =
    typeof details?.qrCodeUri === "string" && details.qrCodeUri.trim() ? details.qrCodeUri.trim() : null;

  void logNewTelInternalVerificationEvent({
    scenario: "signup",
    code: "inbound_started",
    apiOk: true,
    message: "Call-password-id: ожидание входящего звонка пользователя на confirmationNumber.",
    atoms: {
      callId,
      phoneMasked: newTelLogIds.phoneTailMasked(phone),
      confirmationTail: confirmationNumber.replace(/\D/g, "").slice(-4),
    },
  });

  return {
    challengeId: callId,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    confirmationNumber,
    qrCodeUri: qr,
  };
}

export async function confirmPhoneCallVerification(
  challengeId: string,
  phone: string,
  _pin: string,
): Promise<{ verificationTicket: string }> {
  cleanupExpiredTickets();
  const pending = getInboundPending(challengeId);
  if (!pending || pending.phone !== phone || pending.purpose !== "signup") {
    const msg = "Сессия подтверждения не найдена или истекла. Запросите номер для звонка ещё раз.";
    void logNewTelInternalVerificationEvent({
      scenario: "signup",
      code: "session_invalid",
      apiOk: false,
      message: msg,
      atoms: {
        challengeKnown: Boolean(getInboundPending(challengeId)),
        challengeIdTail: newTelLogIds.tailId(challengeId),
        phoneMasked: newTelLogIds.phoneTailMasked(phone),
      },
    });
    throw new Error(msg);
  }
  if (!pending.verified) {
    const msg =
      "Сначала позвоните на номер подтверждения с вашего телефона. Если уже позвонили — подождите несколько секунд и нажмите снова.";
    void logNewTelInternalVerificationEvent({
      scenario: "signup",
      code: "inbound_not_verified_yet",
      apiOk: false,
      message: msg,
      atoms: {
        callId: challengeId,
        phoneMasked: newTelLogIds.phoneTailMasked(phone),
      },
    });
    throw new Error(msg);
  }

  deleteInboundPending(challengeId);
  const token = randomUUID();
  verifiedTickets.set(token, {
    token,
    phone,
    expiresAtMs: Date.now() + VERIFIED_TICKET_TTL_MS,
  });
  void logNewTelInternalVerificationEvent({
    scenario: "signup",
    code: "ticket_issued",
    apiOk: true,
    message: "Номер подтверждён (входящий звонок), выдан verificationTicket.",
    atoms: {
      callId: challengeId,
      phoneMasked: newTelLogIds.phoneTailMasked(phone),
      ticketTail: newTelLogIds.tailId(token),
    },
  });
  return { verificationTicket: token };
}

export function consumePhoneVerificationTicket(phone: string, ticket: string): boolean {
  cleanupExpiredTickets();
  const saved = verifiedTickets.get(ticket);
  if (!saved || saved.phone !== phone) return false;
  verifiedTickets.delete(ticket);
  return true;
}
