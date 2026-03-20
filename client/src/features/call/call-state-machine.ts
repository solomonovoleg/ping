import type { CallState } from "./call-types";

/**
 * Таблица допустимых переходов состояний звонка.
 * Если перехода нет в таблице — он невалиден и будет отклонён.
 */
const TRANSITIONS: Record<CallState, CallState[]> = {
  idle:              ["outgoing_ringing", "incoming_ringing"],
  outgoing_ringing:  ["connecting", "incoming_ringing", "reconnecting", "ended", "busy", "rejected", "missed", "failed"],
  incoming_ringing:  ["accepting", "reconnecting", "rejected", "ended", "missed"],
  accepting:         ["connecting", "reconnecting", "failed", "ended"],
  connecting:        ["connected", "reconnecting", "failed", "ended"],
  connected:         ["reconnecting", "ended"],
  reconnecting:      ["connected", "incoming_ringing", "failed", "ended"],
  ended:             ["idle"],
  rejected:          ["idle"],
  missed:            ["idle"],
  busy:              ["idle"],
  failed:            ["idle"],
};

/** Terminal states — после них звонок завершён, можно вернуться только в idle. */
const TERMINAL_STATES: ReadonlySet<CallState> = new Set<CallState>(["ended", "rejected", "missed", "busy", "failed"]);

/** States where an active call is in progress (peer/media may exist). */
const ACTIVE_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "outgoing_ringing",
  "incoming_ringing",
  "accepting",
  "connecting",
  "connected",
  "reconnecting",
]);

export function isTerminalState(state: CallState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isActiveCallState(state: CallState): boolean {
  return ACTIVE_STATES.has(state);
}

/**
 * Попробовать перейти в новое состояние.
 * Возвращает новое состояние если переход валиден, иначе null.
 */
export function tryTransition(from: CallState, to: CallState): CallState | null {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    if (typeof console !== "undefined") {
      console.warn(`[call-fsm] invalid transition: ${from} → ${to}`);
    }
    return null;
  }
  return to;
}

/**
 * Принудительный переход — для аварийных ситуаций (cleanup, unmount).
 * Не проверяет таблицу переходов, но логирует.
 */
export function forceTransition(from: CallState, to: CallState): CallState {
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    if (typeof console !== "undefined") {
      console.warn(`[call-fsm] forced transition: ${from} → ${to}`);
    }
  }
  return to;
}
