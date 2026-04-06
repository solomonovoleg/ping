export type PlayComplianceStatus = "check" | "manual";

export type PlayComplianceRow = {
  key: string;
  title: string;
  expectation: string;
  productNote: string;
  status: PlayComplianceStatus;
};

export const PLAY_COMPLIANCE_ROWS: PlayComplianceRow[] = [
  {
    key: "data-safety",
    title: "Data safety (форма в Console)",
    expectation:
      "Заявленные сбор, передача и безопасность данных должны совпадать с реальным поведением приложения и SDK.",
    productNote:
      "Сверьте с тем, что уже заполнили для Apple App Privacy; учтите чаты, медиа, аналитику, пуши, контакты.",
    status: "manual",
  },
  {
    key: "ugc",
    title: "UGC: жалобы и блокировка",
    expectation:
      "Встроенные механизмы жалобы на контент и пользователя, блокировка; своевременная реакция на нарушения.",
    productNote:
      "PING: блок 1 жалоб (в т.ч. комментарии), блокировка пользователя; очередь `/admin/ops` (раздел «Жалобы»).",
    status: "check",
  },
  {
    key: "terms",
    title: "Условия и правила для пользователей",
    expectation: "Доступные пользователю правила (ToU / community guidelines), согласованные с модерацией.",
    productNote: "Публичные `/terms` и политика конфиденциальности; ссылки из приложения.",
    status: "check",
  },
  {
    key: "privacy-url-play",
    title: "Privacy Policy URL в Play Console",
    expectation:
      "В карточке приложения указана та же политика конфиденциальности, что и по факту в приложении и в Data safety.",
    productNote:
      "Скопируйте URL из админки «Публичные ссылки» или используйте `VITE_PRIVACY_POLICY_URL` / публичный `/privacy`. Синхронизируйте текст с формой Data safety.",
    status: "manual",
  },
  {
    key: "target-audience",
    title: "Целевая аудитория и контент для детей",
    expectation: "Корректная декларация; при детской аудитории — требования Families и ограничения данных.",
    productNote: "Если приложение не для детей — явно; рейтинг и описание без введения в заблуждение.",
    status: "manual",
  },
];
