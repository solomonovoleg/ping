import { useState, useEffect } from "react";
import { isNative } from "@/lib/capacitor-native";

/** Нативно (Android/iOS): ниже этой ширины — колонка ~480px; планшет / fold развёрнутый / ландшафт — на всю ширину. */
export const NATIVE_WIDE_LAYOUT_MIN_PX = 640;

/**
 * «Телефонная» оболочка (колонка ~480px): узкий экран в приложении или мобильный браузер.
 * Полноширинный вид: натив на широком экране (планшеты, fold) и десктопный браузер без mobile UA.
 */
export function getPreferPhoneChrome(): boolean {
  if (typeof window === "undefined") return true;
  if (isNative()) {
    const w = window.innerWidth || document.documentElement?.clientWidth || 0;
    return w < NATIVE_WIDE_LAYOUT_MIN_PX;
  }
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
    const update = () => setPrefer(getPreferPhoneChrome());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
    };
  }, []);
  return prefer;
}
