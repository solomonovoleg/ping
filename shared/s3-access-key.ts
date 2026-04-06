/**
 * Reg.ru / Cloud.ru Evolution и др.: в панели показывают пару вида `tenant_id/access_key_id`.
 * В SigV4 поле Access Key ID — только часть после `/`; полная строка даёт 400 InvalidArgument на S3 API.
 * Обычные AWS IAM ключи без `/` не трогаем.
 */
export function normalizeS3AccessKeyId(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return t;
  const i = t.indexOf("/");
  if (i <= 0 || i >= t.length - 1) return t;
  const left = t.slice(0, i);
  const right = t.slice(i + 1);
  if (left.length < 8 || right.length < 8) return t;
  if (t.includes("/", i + 1)) return t;
  return right;
}
