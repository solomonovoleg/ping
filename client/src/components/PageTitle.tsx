import { useEffect } from "react";
import { SITE_DOCUMENT_TITLE } from "@/lib/site-seo-defaults";

/** Короткий бренд во вкладке на внутренних экранах: «Чаты — PING». */
const BRAND_SHORT = "PING";

/**
 * Устанавливает document.title и рендерит скрытый h1 для скринридеров (аудит п.59).
 * Использовать в начале контента каждой страницы.
 */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title =
      title === BRAND_SHORT ? SITE_DOCUMENT_TITLE : `${title} — ${BRAND_SHORT}`;
    return () => {
      document.title = SITE_DOCUMENT_TITLE;
    };
  }, [title]);

  return (
    <h1 className="sr-only" id="page-title">
      {title}
    </h1>
  );
}
