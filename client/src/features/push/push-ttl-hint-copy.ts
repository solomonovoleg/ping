import type { PushTtlValue } from "@shared/schema/push-feed";

/** Короткая подпись под сроком в форме Push. */
export function getPushTtlComposerHint(ttl: PushTtlValue): string {
  switch (ttl) {
    case "12h":
      return "~12 ч в разделе Push, затем карточка скрывается (пост по ссылке остаётся).";
    case "24h":
      return "~24 ч в Push, затем карточка скрывается у подписчиков.";
    case "48h":
      return "~48 ч в Push, затем только по прямой ссылке.";
    case "56h":
      return "~56 ч в Push, затем скрывается из входящих.";
    case "forever":
      return "Без авто-скрытия по сроку (пока пост не удалён и карточку не скрыли).";
    default:
      return "Как долго карточка видна в Push.";
  }
}
