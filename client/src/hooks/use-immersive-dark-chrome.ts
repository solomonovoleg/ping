import { useEffect } from "react";

/**
 * На время полноэкранного тёмного медиа (сториз, просмотр фото): theme-color и iOS status bar
 * под чёрный фон — без «светлой полоски» в браузере / PWA.
 */
export function useImmersiveDarkChrome(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const themeMetas = Array.from(
      document.querySelectorAll('meta[name="theme-color"]')
    ) as HTMLMetaElement[];
    const themeBackups = themeMetas.map((el) => ({
      el,
      content: el.getAttribute("content") ?? "",
    }));
    themeMetas.forEach((el) => el.setAttribute("content", "#000000"));

    const appleStatus = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    ) as HTMLMetaElement | null;
    const prevApple = appleStatus?.getAttribute("content");
    if (appleStatus) appleStatus.setAttribute("content", "black-translucent");

    return () => {
      themeBackups.forEach(({ el, content }) => el.setAttribute("content", content));
      if (appleStatus && prevApple != null) appleStatus.setAttribute("content", prevApple);
    };
  }, [active]);
}
