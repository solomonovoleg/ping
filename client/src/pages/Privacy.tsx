import { LegalDocumentShell } from "@/features/store-moderation/block-02-legal/legal-document-shell";
import { PrivacyBody } from "@/features/store-moderation/block-02-legal/privacy-body";

/**
 * Публичная страница политики конфиденциальности (`/privacy`).
 * Для App Store / Google Play и ссылок из приложения.
 */
export default function Privacy() {
  return (
    <LegalDocumentShell
      heading="Политика конфиденциальности"
      documentTitle="Политика конфиденциальности — PING"
      metaDescription="PING: какие персональные данные собираем, цели обработки, пуши и контакты, хранение, права, выгрузка данных и удаление аккаунта."
      publicUrlDocument="privacy"
    >
      <PrivacyBody />
    </LegalDocumentShell>
  );
}
