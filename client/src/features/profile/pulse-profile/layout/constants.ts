/** Отступ контента над глобальной нижней навигацией `AppLayout` */
export const PULSE_PROFILE_NAV_CONTENT_PB = "var(--uix-nav-bottom)";

/** Сквиркл-аватар как в мобильном референсе `MobileProfile` (~84px). */
export const PULSE_AVATAR_PX = 84;
/** Карточка героя заходит на обложку (margin-top). */
export const PULSE_PROFILE_CARD_OVERLAP_PX = 52;
/** Высота блока обложки (хедер профиля). */
export const PULSE_PROFILE_COVER_HEIGHT_PX = 133;
/** Верхний padding скролла при обложке-оверлее: cover − нахлёст карточки героя. */
export const PULSE_PROFILE_SCROLL_BODY_PADDING_TOP_PX =
  PULSE_PROFILE_COVER_HEIGHT_PX - PULSE_PROFILE_CARD_OVERLAP_PX;
/** Отступ блока «био / ссылки / действия» под единой карточкой героя. */
export const PULSE_BODY_AFTER_CARD_PT = 12;
export const PULSE_AVATAR_SQUIRCLE_RX = 20;
/** Для `UserAvatar` внутри кнопки (поле под 2px обводку). */
export const PULSE_PROFILE_AVATAR_INNER_PX = Math.round(PULSE_AVATAR_PX * 0.94);
export const PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX = Math.round(PULSE_AVATAR_SQUIRCLE_RX * 0.88);

export const TEMPLATE_HIGHLIGHTS = [
  { label: "AMG", emoji: "🏎", hasContent: true as const },
  { label: "Работа", emoji: "💼", hasContent: true as const },
  { label: "Путешествия", emoji: "✈️", hasContent: true as const },
];
