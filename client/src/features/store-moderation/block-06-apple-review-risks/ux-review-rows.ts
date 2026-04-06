export type UxReviewRow = {
  key: string;
  title: string;
  whyItMatters: string;
  route: string;
  routeLabel: string;
};

export const UX_REVIEW_ROWS: UxReviewRow[] = [
  {
    key: "clear-actions",
    title: "Понятно, куда нажимать",
    whyItMatters: "На ключевых экранах есть видимые CTA и подписи к действиям, без скрытой логики.",
    route: "/chats",
    routeLabel: "Открыть чаты",
  },
  {
    key: "no-dead-ends",
    title: "Нет тупиков",
    whyItMatters: "Из любого экрана есть путь назад или к следующему шагу, без необходимости перезапуска приложения.",
    route: "/posts",
    routeLabel: "Открыть ленту",
  },
  {
    key: "explicit-feedback",
    title: "Нет состояния «ничего не происходит»",
    whyItMatters: "Критичные действия показывают загрузку, успех или ошибку с понятным продолжением.",
    route: "/notifications",
    routeLabel: "Открыть уведомления",
  },
  {
    key: "core-in-two-taps",
    title: "Основные функции за 1–2 клика",
    whyItMatters: "От домашнего сценария до отправки сообщения, открытия профиля или контента максимум два шага.",
    route: "/settings",
    routeLabel: "Открыть настройки",
  },
  {
    key: "review-notes-ready",
    title: "Review Notes заполнены конкретно под этот билд",
    whyItMatters:
      "Apple отклоняет generic notes: нужны рабочие тест-аккаунты, шаги проверки, ограничения и путь к ключевым функциям.",
    route: "/admin/store-review",
    routeLabel: "Открыть UGC + Review Notes",
  },
  {
    key: "privacy-legal-sync",
    title: "Privacy/Terms/Support синхронизированы с Connect",
    whyItMatters:
      "URL и контакты в приложении, политике и карточке App Store Connect должны совпадать, иначе риск reject по 5.1.1/1.5.",
    route: "/admin/store-review-privacy",
    routeLabel: "Открыть Privacy-чеклист",
  },
  {
    key: "account-delete-path",
    title: "Удаление аккаунта найдено и работает без поддержки",
    whyItMatters:
      "Для приложений с регистрацией удаление должно инициироваться в приложении и быть доступным для ревьюера за несколько тапов.",
    route: "/settings",
    routeLabel: "Открыть настройки",
  },
  {
    key: "metadata-match-build",
    title: "Метаданные строго соответствуют текущему UI",
    whyItMatters:
      "Скриншоты, описание и возрастной рейтинг должны отражать именно ту сборку, которую отправляете на ревью.",
    route: "/admin/store-review-metadata",
    routeLabel: "Открыть листинг-чеклист",
  },
];
