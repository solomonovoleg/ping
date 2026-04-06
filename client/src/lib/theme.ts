/** Ключ в localStorage для выбранной темы */
const THEME_STORAGE_KEY = "ping-theme";

export type ThemeId = "light" | "dark" | "fitfin";

const THEME_CLASSES: ThemeId[] = ["light", "dark", "fitfin"];

function isValidTheme(value: string): value is ThemeId {
  return THEME_CLASSES.includes(value as ThemeId);
}

/**
 * Применяет тему к document: добавляет/удаляет классы .dark и .theme-fitfin.
 * Вызывать до первого рендера, чтобы не было мигания.
 */
export function applyTheme(themeId: ThemeId): void {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-fitfin");
  if (themeId === "dark") root.classList.add("dark");
  else if (themeId === "fitfin") root.classList.add("theme-fitfin");
}

/**
 * Возвращает сохранённую тему или "dark" (дефолт для новых пользователей).
 */
export function getSavedTheme(): ThemeId {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && isValidTheme(saved)) return saved;
  } catch {
    // ignore
  }
  return "dark";
}

/**
 * Сохраняет тему в localStorage и применяет её.
 */
export function setTheme(themeId: ThemeId): void {
  applyTheme(themeId);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // ignore
  }
}
