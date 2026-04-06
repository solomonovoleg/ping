/** Сброс пароля: тот же сценарий call-password-id (клиент звонит на confirmationNumber). */
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
    };
  };
};

type VerifiedTicket = {
  token: string;
  phone: string;
  expiresAtMs: number;
};

const passwordResetTickets = new Map<string, VerifiedTicket>();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [token, ticket] of passwordResetTickets.entries()) {
    if (ticket.expiresAtMs <= now) passwordResetTickets.delete(token);
  }
}

export type StartPasswordResetInboundResult = {
  challengeId: string;
  expiresAt: string;
  confirmationNumber: string;
  qrCodeUri: string | null;
};

export async function startPasswordResetPhoneVerification(
  phone: string,
  webhookPublicBaseUrl: string,
): Promise<StartPasswordResetInboundResult> {
  const clientNumber = normalizeDigitsPhone(phone);
  const base = webhookPublicBaseUrl.replace(/\/+$/, "");
  const callbackLink = `${base}/api/auth/new-tel/callpassword-id/webhook`;
  const payload: Record<string, unknown> = {
    callbackLink,
    clientNumber,
    timeout: 120,
    userData: "password_reset",
  };

  const response = await callNewTelPasswordApi<StartCallPasswordIdResponse>(
    "call-password-id/start-waiting-mode-busy",
    payload,
    { scenario: "password_reset" },
  );
  const methodError = extractNewTelMethodError(response);
  if (methodError) throw new Error(methodError);

  const details = response.data?.callDetails;
  const callId = typeof details?.callId === "string" ? details.callId.trim() : "";
  const confirmationNumber =
    typeof details?.confirmationNumber === "string" ? details.confirmationNumber.trim() : "";
  if (!callId || !confirmationNumber) {
    const msg = "Не удалось начать сброс. Проверьте номер и попробуйте снова.";
    void logNewTelInternalVerificationEvent({
      scenario: "password_reset",
      code: "inbound_start_invalid",
      apiOk: false,
      message: msg,
      atoms: { hasCallId: Boolean(callId), hasConfirmation: Boolean(confirmationNumber) },
    });
    throw new Error(msg);
  }

  setInboundPending(callId, phone, clientNumber, "password_reset");
  const qr =
    typeof details?.qrCodeUri === "string" && details.qrCodeUri.trim() ? details.qrCodeUri.trim() : null;

  void logNewTelInternalVerificationEvent({
    scenario: "password_reset",
    code: "inbound_started",
    apiOk: true,
    message: "Call-password-id: ожидание звонка для сброса пароля.",
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

/** Только чтение: вебхук New-Tel уже выставил verified — без выдачи тикета. */
export function isPasswordResetChallengeVerified(challengeId: string, phone: string): boolean {
  const pending = getInboundPending(challengeId);
  if (!pending || pending.phone !== phone || pending.purpose !== "password_reset") return false;
  return pending.verified;
}

export async function confirmPasswordResetPhoneVerification(
  challengeId: string,
  phone: string,
  _pin: string,
): Promise<{ resetTicket: string }> {
  cleanupExpired();
  const pending = getInboundPending(challengeId);
  if (!pending || pending.phone !== phone || pending.purpose !== "password_reset") {
    const msg = "Сессия сброса не найдена или истекла. Запросите звонок ещё раз.";
    void logNewTelInternalVerificationEvent({
      scenario: "password_reset",
      code: "session_invalid",
      apiOk: false,
      message: msg,
      atoms: {
        challengeIdTail: newTelLogIds.tailId(challengeId),
        phoneMasked: newTelLogIds.phoneTailMasked(phone),
      },
    });
    throw new Error(msg);
  }
  if (!pending.verified) {
    const msg =
      "Сначала позвоните на номер подтверждения. Если уже позвонили — подождите и нажмите снова.";
    void logNewTelInternalVerificationEvent({
      scenario: "password_reset",
      code: "inbound_not_verified_yet",
      apiOk: false,
      message: msg,
      atoms: { callId: challengeId, phoneMasked: newTelLogIds.phoneTailMasked(phone) },
    });
    throw new Error(msg);
  }

  deleteInboundPending(challengeId);
  const token = randomUUID();
  passwordResetTickets.set(token, {
    token,
    phone,
    expiresAtMs: Date.now() + VERIFIED_TICKET_TTL_MS,
  });
  void logNewTelInternalVerificationEvent({
    scenario: "password_reset",
    code: "ticket_issued",
    apiOk: true,
    message: "Сброс: номер подтверждён входящим звонком.",
    atoms: {
      callId: challengeId,
      phoneMasked: newTelLogIds.phoneTailMasked(phone),
      ticketTail: newTelLogIds.tailId(token),
    },
  });
  return { resetTicket: token };
}

export function consumePasswordResetTicket(phone: string, ticket: string): boolean {
  cleanupExpired();
  const saved = passwordResetTickets.get(ticket);
  if (!saved || saved.phone !== phone) return false;
  passwordResetTickets.delete(ticket);
  return true;
}
