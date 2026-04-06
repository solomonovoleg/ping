/** Тексты про аудиторию Push (подписчики в ленте vs push на устройство). */
export function describePushAudience(inFeed: number, notify: number): { long: string; short: string } {
  if (inFeed <= 0) {
    return {
      long: "Подписчиков на Push пока нет — карточку некому показать.",
      short: "Нет подписчиков на Push.",
    };
  }
  if (notify >= inFeed) {
    return {
      long: `Получат: ${inFeed} (все с уведомлением на телефон).`,
      short: `До ${inFeed} чел. · push на телефон всем`,
    };
  }
  return {
    long: `В ленту Push: ${inFeed} · Push на телефон: ${notify} (остальные — только в приложении)`,
    short: `Лента: ${inFeed} · push на телефон: ${notify}`,
  };
}
