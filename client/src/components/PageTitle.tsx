import { useEffect } from "react";

const BASE_TITLE = "PING";

/**
 * Устанавливает document.title и рендерит скрытый h1 для скринридеров (аудит п.59).
 * Использовать в начале контента каждой страницы.
 */
export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title === BASE_TITLE ? BASE_TITLE : `${title} — ${BASE_TITLE}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);

  return (
    <h1 className="sr-only" id="page-title">
      {title}
    </h1>
  );
}
