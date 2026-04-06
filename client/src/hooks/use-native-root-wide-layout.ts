import { useEffect } from "react";
import { isNative } from "@/lib/capacitor-native";
import { NATIVE_WIDE_LAYOUT_MIN_PX, getPreferPhoneChrome } from "@/hooks/use-prefer-phone-chrome";

/**
 * Снимает глобальный max-width:480px у `#root` в index.css на нативном широком окне (планшет, fold).
 * Должен монтироваться всегда (в т.ч. до логина), иначе экран входа остаётся в узкой колонке.
 */
export function useNativeRootWideLayoutAttribute(): void {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const sync = () => {
      const w = window.innerWidth || document.documentElement?.clientWidth || 0;
      const wideNative = isNative() && w >= NATIVE_WIDE_LAYOUT_MIN_PX;
      const wideWeb = !isNative() && !getPreferPhoneChrome();
      const wide = wideNative || wideWeb;
      if (wide) root.setAttribute("data-native-wide-layout", "1");
      else root.removeAttribute("data-native-wide-layout");
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      vv?.removeEventListener("resize", sync);
    };
  }, []);
}
