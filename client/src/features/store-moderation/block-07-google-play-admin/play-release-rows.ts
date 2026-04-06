export type PlayReleaseRow = {
  key: string;
  title: string;
  audience: "admin" | "user" | "moderator";
  route: string;
  routeLabel: string;
  note: string;
};

export const PLAY_RELEASE_ROWS: PlayReleaseRow[] = [
  {
    key: "cross-store-ugc-parity",
    title: "Сверить описание жалоб с Apple UGC (единые правила для обоих сторов)",
    audience: "moderator",
    route: "/admin/store-review",
    routeLabel: "Открыть Apple UGC",
    note: "Тексты для ревьюера и фактическое поведение приложения должны совпадать на iOS и Android.",
  },
  {
    key: "moderation-ops-queue",
    title: "Проверить очередь жалоб и SLA реакции",
    audience: "moderator",
    route: "/admin/ops",
    routeLabel: "Открыть Операции",
    note: "Жалобы должны обрабатываться без тупиков и зависших статусов.",
  },
  {
    key: "admin-policy-consistency",
    title: "Согласовать Data Safety и фактические данные",
    audience: "admin",
    route: "/admin/store-review-play",
    routeLabel: "Открыть Google Play блок",
    note: "Декларации Play Console должны соответствовать реальному поведению приложения.",
  },
  {
    key: "user-chat-path",
    title: "Пользователь: старт чата и отправка сообщения за 1–2 клика",
    audience: "user",
    route: "/chats",
    routeLabel: "Открыть чаты",
    note: "Критичный сценарий должен быть очевидным и быстрым.",
  },
  {
    key: "user-feed-path",
    title: "Пользователь: открыть ленту и контент без тупиков",
    audience: "user",
    route: "/posts",
    routeLabel: "Открыть ленту",
    note: "Есть понятный путь назад и к следующему шагу.",
  },
  {
    key: "user-notifications-feedback",
    title: "Пользователь: уведомления дают понятный переход в действие",
    audience: "user",
    route: "/notifications",
    routeLabel: "Открыть уведомления",
    note: "Нет состояния «нажал и ничего не произошло».",
  },
];
