import type { PrivacyComplianceRow } from "./types";

/** Чеклист: Connect + нативные требования, дополняющие блок 3 (UGC). */
export const PRIVACY_COMPLIANCE_ROWS: PrivacyComplianceRow[] = [
  {
    key: "account-delete",
    title: "Удаление аккаунта в приложении",
    appleTopic: "Account deletion",
    expectation:
      "Создание аккаунта → возможность начать удаление из приложения; не только деактивация; разумная доступность в настройках.",
    productNote:
      "Настройки → «Удалить аккаунт» (диалог подтверждения), API `deleteAccount`. Убедитесь, что ревьюер находит за ≤3 тапа.",
    status: "implemented",
  },
  {
    key: "app-privacy-questionnaire",
    title: "App Privacy (анкета в Connect)",
    appleTopic: "App Privacy Details",
    expectation:
      "Раскрыть данные, которые собирает приложение и партнёры, цели использования; должно согласовываться с политикой.",
    productNote:
      "Сверьте каждую категорию с `/privacy` и фактическим SDK (пуши, аналитика, WebRTC и т.д.). Обновляйте анкету при новых сборах.",
    status: "manual",
  },
  {
    key: "privacy-policy-url",
    title: "Privacy Policy URL в Connect",
    appleTopic: "App Store Connect",
    expectation: "В карточке приложения указана актуальная ссылка на политику конфиденциальности.",
    productNote:
      "Используйте тот же URL, что в билде (`VITE_PRIVACY_POLICY_URL` или публичный `/privacy`). Скопировать из админки: карточка «Публичные ссылки».",
    status: "manual",
  },
  {
    key: "support-url",
    title: "Support URL и контакты",
    appleTopic: "Guideline 1.5",
    expectation: "Пользователь может связаться с вами; Support URL в Connect должен быть действительным.",
    productNote: "Email в настройках приложения и `getSupportEmail()`; сайт/страница поддержки не должны отдавать 404.",
    status: "manual",
  },
  {
    key: "export-compliance",
    title: "Export compliance (шифрование)",
    appleTopic: "App encryption / export",
    expectation:
      "Если используется шифрование сверх стандартного шифрования ОС — ответить на вопросник в Connect; при необходимости документы.",
    productNote:
      "HTTPS, TLS, WebRTC обычно попадают под стандартные ответы анкеты; уточните формулировки для вашей сборки в Connect.",
    status: "manual",
  },
  {
    key: "usage-descriptions",
    title: "NS*UsageDescription (iOS)",
    appleTopic: "Guideline 2.1 / отказы ревью",
    expectation:
      "Для камеры, микрофона, фото, контактов и т.д. — осмысленные строки в Info.plist; без них ревью часто режет билд.",
    productNote: "Проверьте `ios/App/App/Info.plist` (или Capacitor config): тексты на языке ревью при необходимости.",
    status: "manual",
  },
  {
    key: "privacy-manifest",
    title: "Privacy manifest + Required reason APIs",
    appleTopic: "Privacy manifest files",
    expectation:
      "В сборке корректно описаны required reason APIs и privacy manifests для приложения/SDK; данные согласованы с App Privacy.",
    productNote:
      "Добавьте и поддерживайте app-level `PrivacyInfo.xcprivacy`; проверьте в Xcode privacy report, что причины для API валидны и нет конфликтов с SDK-манифестами.",
    status: "manual",
  },
  {
    key: "sdk-signatures",
    title: "Common SDK requirements (signatures/manifests)",
    appleTopic: "Third-party SDK requirements",
    expectation:
      "Для популярных сторонних SDK соблюдены требования Apple по privacy manifests и signatures (когда применимо).",
    productNote:
      "Проверьте зависимости из Podfile/Capacitor: Capacitor, Firebase и связанные библиотеки должны идти с актуальными манифестами и корректно валидироваться при upload.",
    status: "manual",
  },
  {
    key: "tracking-att",
    title: "App Tracking Transparency",
    appleTopic: "ATT",
    expectation: "Если трекаете пользователей между приложениями/сайтами — запрос ATT и цель в Privacy.",
    productNote: "Если трекинга нет — в анкете и политике явно не заявляйте лишнего; при добавлении SDK — пересмотреть.",
    status: "manual",
  },
];
