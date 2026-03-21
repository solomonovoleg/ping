import { useState, useEffect } from "react";
import { isNative } from "@/lib/capacitor-native";

/**
 * «Телефонная» оболочка (колонка ~480px): нативное приложение и мобильные/планшетные устройства.
 * Полноширинный «десктопный» вид — только в обычном браузере на ПК/ноутбуке (без mobile UA).
 */
export function getPreferPhoneChrome(): boolean {
  if (typeof window === "undefined") return true;
  if (isNative()) return true;
  const ua = navigator.userAgent || "";
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/\biPad\b/i.test(ua)) return true;
  // iPadOS 13+ в Safari часто маскируется под Macintosh
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function usePreferPhoneChrome(): boolean {
  const [prefer, setPrefer] = useState(() =>
    typeof window !== "undefined" ? getPreferPhoneChrome() : true,
  );
  useEffect(() => {
    setPrefer(getPreferPhoneChrome());
  }, []);
  return prefer;
}
