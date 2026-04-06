import { LegalDocumentShell } from "./legal-document-shell";
import { TermsBody } from "./terms-body";

/**
 * Публичная страница условий использования (`/terms`).
 * Для App Store / Google Play и ссылок из приложения.
 */
export default function TermsPage() {
  return (
    <LegalDocumentShell
      heading="Условия использования"
      documentTitle="Условия использования — PING"
      metaDescription="Правила использования PING: аккаунт, пользовательский контент, модерация и жалобы, ограничение ответственности, применимое право."
      publicUrlDocument="terms"
    >
      <TermsBody />
    </LegalDocumentShell>
  );
}
