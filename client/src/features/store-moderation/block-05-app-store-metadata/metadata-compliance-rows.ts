import type { MetadataComplianceRow } from "./types";

export const METADATA_COMPLIANCE_ROWS: MetadataComplianceRow[] = [
  {
    key: "screenshots-ui",
    title: "Скриншоты = реальный UI",
    source: "Guideline 2.3 / Connect",
    expectation:
      "Кадры отражают текущую версию приложения; без несуществующих экранов; виден интерфейс приложения (не только текст на фоне).",
    productNote:
      "Чат, лента, профиль, сториз/звонок — по факту того, что в билде. Сверьте размеры с официальной справкой Apple (ссылка выше).",
    status: "manual",
  },
  {
    key: "screenshots-forbidden",
    title: "Запреты на скриншотах",
    source: "Review / практика",
    expectation:
      "Обычно не допускают цены, вводящие сравнения с конкурентами, ложную строку состояния, награды не от Apple.",
    productNote: "Маркетинговая рамка вокруг UI допустима, если не скрывает суть экрана.",
    status: "manual",
  },
  {
    key: "description",
    title: "Описание и промо-тексты",
    source: "§2.3 Accuracy",
    expectation: "Описание, подзаголовок и «Что нового» соответствуют функциям; нет скрытых платных функций без IAP.",
    productNote: "Укажите чаты, ленту, звонки, UGC только если это реально в сборке для ревью.",
    status: "manual",
  },
  {
    key: "age-rating",
    title: "Возрастной рейтинг (анкета)",
    source: "App Store Connect",
    expectation:
      "Честные ответы: пользовательский контент, чаты/сообщения, ненормативная лексика и т.д. влияют на рейтинг и доступность по регионам.",
    productNote:
      "Для мессенджера и ленты отметьте UGC и обмен сообщениями. Проверьте, что заполнена обновлённая анкета age rating в Connect (система рейтингов обновлена в 2026).",
    status: "manual",
  },
  {
    key: "sdk-minimum",
    title: "Минимальные SDK/Xcode для загрузки",
    source: "Upcoming Requirements",
    expectation:
      "Сборка соответствует минимальным требованиям Apple для App Store Connect (актуальные SDK и версия Xcode на дату сабмита).",
    productNote:
      "Перед релизом проверьте «Upcoming requirements» в Apple Developer и обновите CI/локальную сборку под требуемую версию Xcode и iOS SDK.",
    status: "manual",
  },
  {
    key: "keywords",
    title: "Ключевые слова",
    source: "Connect",
    expectation: "Без чужих торговых марок и лишних категорий; лимит символов соблюдать.",
    productNote: "Пересмотр при каждом крупном релизе; не дублировать слова из названия без пользы.",
    status: "manual",
  },
  {
    key: "preview-video",
    title: "App Preview (видео)",
    source: "Connect (опционально)",
    expectation: "Если загружаете превью — оно должно показывать реальный UX, без вводящего в заблуждение монтажа.",
    productNote: "Не обязательно; при отсутствии — достаточно качественных скриншотов.",
    status: "ok",
  },
  {
    key: "localizations",
    title: "Локализации",
    source: "Connect",
    expectation: "Для каждой локали скриншоты и тексты согласованы; пустые или машинный перевод без проверки — риск.",
    productNote: "Минимум: русский + английский, если открываете англоязычные сторы.",
    status: "risk",
  },
];
