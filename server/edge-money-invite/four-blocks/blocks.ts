/** Краткое описание 4 блоков внедрения (см. docs/EDGE_MONEY_INVITE_FOUR_BLOCKS.md). */
export const EDGE_MONEY_INVITE_FOUR_BLOCKS = [
  {
    id: 1,
    title: "Данные и инварианты",
    summary: "Таблица партий, связь referral_codes → batch, gate «следующая тройка».",
  },
  {
    id: 2,
    title: "HTTP и выдача пакета",
    summary: "Маршрут выдачи 3 кодов + ЛС; прогресс для UI без verify «уже N рефералов» на выдаче.",
  },
  {
    id: 3,
    title: "События и баллы EDGE MONEY",
    summary: "platform-events, начисление по invite_friend, идемпотентность.",
  },
  {
    id: 4,
    title: "Клиент",
    summary: "Прогресс и кнопка в edge-money-template.",
  },
] as const;
