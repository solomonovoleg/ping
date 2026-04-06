import type { StoreReviewChecklistRow } from "./types";

const APPLE_CREATOR_EXPECTATION =
  "Creator apps: способ отметить контент выше возрастного рейтинга приложения + ограничение доступа несовершеннолетним " +
  "(по заявленному/подтверждённому возрасту).";

/**
 * Чеклист для команды: соотнесение гайдлайнов Apple с продуктом.
 * Статусы — ориентир; перед релизом перепроверьте в Connect и в билде.
 */
export const STORE_REVIEW_CHECKLIST_ROWS: StoreReviewChecklistRow[] = [
  {
    key: "filter",
    title: "Фильтрация возражаемого контента",
    appleRef: "1.2",
    appleExpectation: "Метод снижать появление недопустимого контента в приложении.",
    productNote:
      "Скрытие поста из ленты, удаление своих сообщений/постов, модерация жалоб в «Операции». При усилении требований — рассмотреть авто-фильтры/лимиты.",
    status: "partial",
  },
  {
    key: "report",
    title: "Жалобы на контент",
    appleRef: "1.2",
    appleExpectation: "Механизм сообщать о оскорбительном контенте и своевременно реагировать.",
    productNote:
      "В приложении: «Пожаловаться» (чат, пост, профиль, сториз) → API жалоб. В админке: очередь в «Операции» — обрабатывайте в разумный срок.",
    status: "implemented",
  },
  {
    key: "block",
    title: "Блокировка пользователей",
    appleRef: "1.2",
    appleExpectation: "Возможность блокировать злоупотребляющих пользователей.",
    productNote: "Блокировка из профиля и чата (user-blocking). Проверьте сценарии на ревью-сборке.",
    status: "implemented",
  },
  {
    key: "contact",
    title: "Контакты для пользователей",
    appleRef: "1.2, 1.5",
    appleExpectation: "Опубликованные контакты, по которым пользователь может связаться с вами.",
    productNote:
      "Email поддержки в настройках, политика/условия (`getSupportEmail`, страницы /privacy и /terms). В App Store Connect укажите Support URL и совпадающий email.",
    status: "implemented",
  },
  {
    key: "creator-age",
    title: "Creator apps и возраст (п. 1.2(a))",
    appleRef: "1.2(a)",
    appleExpectation: APPLE_CREATOR_EXPECTATION,
    productNote:
      "Если позиционируете приложение как платформу для создателей с контентом выше возрастного рейтинга — нужны маркировка контента и ограничение по возрасту. Иначе убедитесь, что рейтинг и метаданные в Connect соответствуют реальному UGC.",
    status: "manual",
  },
  {
    key: "privacy-url",
    title: "Политика конфиденциальности",
    appleRef: "5.1.1",
    appleExpectation: "Ссылка на политику; соответствие фактическому сбору данных (App Privacy в Connect).",
    productNote:
      "Страница /privacy, VITE_PRIVACY_POLICY_URL при необходимости. Синхронизируйте анкету App Privacy с текстом. URL для Connect — карточка «Публичные ссылки» в админке (Сторы / UGC, Privacy, Play).",
    status: "manual",
  },
  {
    key: "terms",
    title: "Условия использования",
    appleRef: "UGC / доверие ревью",
    appleExpectation: "Понятные правила поведения и UGC (часто проверяют вместе с жалобами и блокировкой).",
    productNote: "Страница /terms, ссылка в настройках и на экране входа. Для Google Play — отдельно Data safety.",
    status: "implemented",
  },
  {
    key: "review-notes",
    title: "App Review Notes",
    appleRef: "2.1, 2.3",
    appleExpectation:
      "Тестовый аккаунт, инвайт-код, что смотреть; новые функции — конкретно (generic описания отклоняют).",
    productNote:
      "Заполните шаблон ниже. Укажите два тестовых аккаунта (для чата/звонка), инвайт при закрытой регистрации и точный путь к report/block/delete-account.",
    status: "manual",
  },
  {
    key: "demo",
    title: "Рабочий билд без заглушек",
    appleRef: "2.1",
    appleExpectation: "Полнофункциональный контент для проверки; без «скоро» вместо фич.",
    productNote: "Прогон основных сценариев за 2 минуты на том же билде, что отправляется.",
    status: "manual",
  },
  {
    key: "sign-in-apple",
    title: "Sign in with Apple",
    appleRef: "4.8",
    appleExpectation: "Если есть вход через сторонние соцсети — обычно требуется Sign in with Apple на iOS.",
    productNote: "У нас вход по телефону/паролю — чаще не применяется. Проверьте, если добавите Google/Facebook и т.д.",
    status: "manual",
  },
  {
    key: "google-play-ugc",
    title: "Google Play (UGC)",
    appleRef: "Play / Data safety",
    appleExpectation:
      "Приложения с UGC: жалоба и блокировка в приложении, обработка нарушений; форма Data safety согласована с политикой.",
    productNote:
      "Жалобы/блок есть в приложении. В Play Console заполните Data safety и укажите те же категории данных, что в /privacy.",
    status: "manual",
  },
];
