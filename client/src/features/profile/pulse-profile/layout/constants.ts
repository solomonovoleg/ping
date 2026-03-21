/** Отступ контента над глобальной нижней навигацией `AppLayout` */
export const PULSE_PROFILE_NAV_CONTENT_PB = "var(--uix-nav-bottom)";

/** Сквиркл-аватар как в мобильном референсе `MobileProfile` (~84px). */
export const PULSE_AVATAR_PX = 84;
/** Видимый круг «+» у аватара: ~¼ диаметра на сквиркле, остальное снаружи (смещение = −0.75×диаметр). */
export const PULSE_AVATAR_PLUS_BADGE_PX = 16;
/** Зона нажатия вокруг бейджа (доступность). */
export const PULSE_AVATAR_PLUS_HIT_PX = 44;
/** Насколько сместить контейнер касания от угла аватара (наружу), чтобы бейдж имел нужный нахлёст. */
export const PULSE_AVATAR_PLUS_CONTAINER_OFFSET_PX =
  Math.round(PULSE_AVATAR_PLUS_BADGE_PX * 0.75) + (PULSE_AVATAR_PLUS_HIT_PX - PULSE_AVATAR_PLUS_BADGE_PX) / 2;
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
