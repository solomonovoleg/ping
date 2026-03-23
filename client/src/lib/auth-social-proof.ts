const AUTH_SOCIAL_PROOF_KEY = "auth_social_proof_v1";
const MIN_DAILY_GROWTH = 49;
const MAX_DAILY_GROWTH = 118;
const INITIAL_REGISTERED_BASE = 241094;
const FALLBACK_TODAY_GROWTH = 83;

type AuthSocialProofState = {
  dayKey: string;
  registeredBase: number;
  todayGrowth: number;
};

function dayKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayKey(dayKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dayKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]) - 1;
  const d = Number(m[3]);
  const parsed = new Date(y, mm, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== mm ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function randomDailyGrowth(): number {
  return MIN_DAILY_GROWTH + Math.floor(Math.random() * (MAX_DAILY_GROWTH - MIN_DAILY_GROWTH + 1));
}

function createInitialState(todayKey: string): AuthSocialProofState {
  return {
    dayKey: todayKey,
    registeredBase: INITIAL_REGISTERED_BASE,
    todayGrowth: randomDailyGrowth(),
  };
}

function readStoredState(): AuthSocialProofState | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SOCIAL_PROOF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSocialProofState>;
    if (
      typeof parsed !== "object" ||
      typeof parsed.dayKey !== "string" ||
      typeof parsed.registeredBase !== "number" ||
      typeof parsed.todayGrowth !== "number"
    ) {
      return null;
    }
    return {
      dayKey: parsed.dayKey,
      registeredBase: Math.max(0, Math.floor(parsed.registeredBase)),
      todayGrowth: Math.max(MIN_DAILY_GROWTH, Math.min(MAX_DAILY_GROWTH, Math.floor(parsed.todayGrowth))),
    };
  } catch {
    return null;
  }
}

function saveState(state: AuthSocialProofState): void {
  try {
    window.localStorage.setItem(AUTH_SOCIAL_PROOF_KEY, JSON.stringify(state));
  } catch {
    // ignore localStorage write errors (private mode / quota)
  }
}

function daysDiff(from: Date, to: Date): number {
  const fromMidnight = new Date(from);
  fromMidnight.setHours(0, 0, 0, 0);
  const toMidnight = new Date(to);
  toMidnight.setHours(0, 0, 0, 0);
  const diffMs = toMidnight.getTime() - fromMidnight.getTime();
  return Math.floor(diffMs / 86_400_000);
}

export function getAuthSocialProof(): { registeredBase: number; todayGrowth: number } {
  if (typeof window === "undefined") {
    return {
      registeredBase: INITIAL_REGISTERED_BASE,
      todayGrowth: FALLBACK_TODAY_GROWTH,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKeyFromDate(today);
  const stored = readStoredState();
  let state = stored ?? createInitialState(todayKey);

  const stateDayDate = parseDayKey(state.dayKey);
  if (!stateDayDate) {
    state = createInitialState(todayKey);
    saveState(state);
    return { registeredBase: state.registeredBase, todayGrowth: state.todayGrowth };
  }

  if (state.dayKey === todayKey) {
    return { registeredBase: state.registeredBase, todayGrowth: state.todayGrowth };
  }

  const diff = daysDiff(stateDayDate, today);
  if (diff <= 0) {
    return { registeredBase: state.registeredBase, todayGrowth: state.todayGrowth };
  }

  // Переносим завершённый "сегодня" прошлого дня в общую базу.
  let registeredBase = state.registeredBase + state.todayGrowth;
  // Если приложение не открывали несколько дней, докручиваем пропущенные дни.
  for (let i = 1; i < diff; i += 1) {
    registeredBase += randomDailyGrowth();
  }
  const nextState: AuthSocialProofState = {
    dayKey: todayKey,
    registeredBase,
    todayGrowth: randomDailyGrowth(),
  };
  saveState(nextState);
  return { registeredBase: nextState.registeredBase, todayGrowth: nextState.todayGrowth };
}
