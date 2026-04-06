import { insertNewTelCallPasswordLogRow, type NewTelCallPasswordLogScenario } from "./new-tel-call-password-log.repo";

function tailId(id: string, n = 8): string {
  const s = String(id).replace(/-/g, "");
  return s.length <= n ? s : s.slice(-n);
}

function phoneTailMasked(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `***${d.slice(-4)}` : "***";
}

/**
 * Событие уровня приложения (не отдельный HTTP к New-Tel): отказ/успех подтверждения с атомарным контекстом.
 */
export async function logNewTelInternalVerificationEvent(p: {
  scenario: NewTelCallPasswordLogScenario;
  /** Короткий код: pin_mismatch, session_invalid, … */
  code: string;
  apiOk: boolean;
  /** Точный текст, который видит пользователь или внутренняя причина */
  message: string | null;
  atoms: Record<string, unknown>;
}): Promise<void> {
  await insertNewTelCallPasswordLogRow({
    scenario: p.scenario,
    apiMethod: `internal/verification/${p.code}`,
    durationMs: 0,
    httpStatus: null,
    apiOk: p.apiOk,
    errorMessage: p.apiOk ? null : p.message,
    requestRedacted: { code: p.code, ...shallowAtoms(p.atoms) },
    responseSanitized: null,
    detail: {
      kind: "app_verification",
      code: p.code,
      apiOk: p.apiOk,
      outcomeMessage: p.message,
      atoms: p.atoms,
    },
  });
}

function shallowAtoms(atoms: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(atoms)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    }
  }
  return out;
}

export const newTelLogIds = { tailId, phoneTailMasked };
