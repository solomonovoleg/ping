import { useSyncExternalStore } from "react";
import type { PulseProfileThemeMode } from "./pulse-profile-theme";

function subscribe(onChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(() => onChange());
  mo.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

function getSnapshot(): PulseProfileThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): PulseProfileThemeMode {
  return "light";
}

/** Тема оболочки PULSE-профиля = глобальная тема приложения (`html.dark` из настроек). */
export function usePulseProfileThemeFromDocument(): PulseProfileThemeMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
