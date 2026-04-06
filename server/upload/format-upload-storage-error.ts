/**
 * Понятный текст для клиента при сбое записи в S3 или на диск.
 * AWS SDK v3 и MinIO по-разному заполняют name / message / $metadata / Code.
 */

export type UploadStorageMode = "s3" | "disk";

function gatherErrText(err: unknown): { name: string; msg: string; msgL: string; http: number; code: string } {
  if (!err || typeof err !== "object") {
    const s = String(err ?? "");
    return { name: "", msg: s, msgL: s.toLowerCase(), http: 0, code: "" };
  }
  const e = err as Record<string, unknown>;
  const name = String(e.name ?? "");
  const msg = String(e.message ?? "");
  const meta = e.$metadata as { httpStatusCode?: number } | undefined;
  const http = typeof meta?.httpStatusCode === "number" ? meta.httpStatusCode : 0;
  const code = String((e as { Code?: string }).Code ?? (e as { code?: string }).code ?? "");
  const nested = e.$response as { statusCode?: number } | undefined;
  const http2 = typeof nested?.statusCode === "number" ? nested.statusCode : 0;
  const httpFinal = http || http2;
  return { name, msg, msgL: msg.toLowerCase(), http: httpFinal, code };
}

/**
 * Распознавание типичных отказов S3-совместимых API (в т.ч. MinIO-клиент).
 * Возвращает null, если паттерн неузнаваем — дальше общие эвристики.
 */
export function mapS3CompatibleErrorToUserMessage(err: unknown): string | null {
  const { name, msg, msgL, http, code } = gatherErrText(err);
  const bundle = `${name} ${code} ${http} ${msgL}`;

  if (/invalidaccesskey|nosuchaccesskey|invalidtoken|expiredtoken|signaturedoesnotmatch|signatur|credentialsnotfound/i.test(bundle)) {
    return "S3 отклонил ключи: проверьте S3_ACCESS_KEY и S3_SECRET_KEY. Reg.ru/Cloud.ru: в .env можно оставить ключ как в панели `tenant/access_key_id` — для подписи используется только часть после `/`.";
  }
  if (/accessdenied|access denied/i.test(bundle) || (http === 403 && /denied|forbidden|access/i.test(msgL))) {
    return "Доступ к бакету запрещён: у ключа должны быть права на запись (PutObject) в этот бакет и корректная политика бакета.";
  }
  if (/nosuchbucket/i.test(code) || /nosuchbucket/i.test(name) || /no such bucket/i.test(msgL)) {
    return "Бакет не найден: проверьте S3_BUCKET и что бакет создан в той же зоне, что указана в S3_REGION / endpoint.";
  }
  if (http === 404 && /not found|bucket|key/i.test(msgL)) {
    return "Объект или бакет не найден по текущему S3_ENDPOINT — проверьте URL (path-style), имя бакета и регион.";
  }
  if (/entitytoolarge|maxbodylength|payload too large|request body too large/i.test(bundle)) {
    return "Файл слишком большой для приёма (nginx, прокси или лимит бакета). Уменьшите файл; на nginx нужен client_max_body_size.";
  }
  if (/slowdown|throttl|503|service unavailable|busy/i.test(bundle) && (http === 503 || /slow|throttl|unavailable/i.test(msgL))) {
    return "Хранилище перегружено или временно недоступно. Подождите и повторите загрузку.";
  }
  if (
    /invalidargument|invalidrequest|malformedxml|bad digest|x-amz-checksum|checksum did not match|crc32/i.test(bundle) ||
    (name === "UnknownError" && http === 400)
  ) {
    return "Провайдер отклонил PutObject (несовместимые заголовки/подпись). Обновите сервер: для Reg.ru SDK шлёт минимальный PutObject и при 400 есть fallback на Minio. Если ошибка остаётся — проверьте S3_REGION, ключи и политику бакета; опционально S3_REGRU_MINIO_PUT=1.";
  }
  if (/network|econnreset|etimedout|socket hang|enotfound|getaddrinfo|econnrefused|certificate|ssl|tls|x509/i.test(bundle)) {
    return "Сбой соединения с S3 (обрыв/TLS/DNS). Проверьте S3_ENDPOINT и исходящий 443 с VPS. На s3.regru.cloud обновите сервер: PutObject через AWS SDK + keep-alive; Minio там часто даёт ECONNRESET.";
  }
  if (/max request|body length|request size|too big/i.test(msgL) && /buffer|memory/i.test(msgL)) {
    return "Файл не помещается в память процесса при загрузке в S3. Уменьшите размер видео или увеличьте лимит памяти Node / загружайте сжатые фото.";
  }

  return null;
}

export type FormatUploadStorageOptions = {
  /** Откуда шла запись — чтобы доклеить подсказку, если причина не распознана */
  storageMode?: UploadStorageMode;
};

/**
 * Понятный текст для клиента при сбое записи в S3 (AWS SDK часто даёт «UnknownError»).
 */
export function formatUploadStorageError(err: unknown, logLabel: string, opts?: FormatUploadStorageOptions): string {
  console.error(logLabel, err);
  const s3Mapped = mapS3CompatibleErrorToUserMessage(err);
  if (s3Mapped) return s3Mapped;

  const e = err instanceof Error ? err : new Error(String(err));
  const errLike = e as unknown as { name?: string; message?: string; code?: string };
  const msg = `${errLike.name ?? ""} ${errLike.message ?? ""}`.toLowerCase();
  const code = typeof errLike.code === "string" ? errLike.code.toLowerCase() : "";
  const haystack = `${code} ${msg}`;
  if (
    /unknownerror|networkingerror|putobject|nosuchbucket|@aws-sdk|the bucket|forbidden|xamz|econnreset|etimedout|socket|getaddrinfo|enotfound|timeout|credentials|accessdenied|invalidaccesskey|signature|x509|certificate/i.test(
      msg,
    )
  ) {
    return "Хранилище файлов временно недоступно. Попробуйте через минуту.";
  }
  if (/enospc|no space left|quota|disk full|eacces|eperm|erofs|read-only file system|emfile|enfile/i.test(haystack)) {
    return "Не удалось записать файл на диск сервера (место или права доступа). Проверьте сервер.";
  }

  const tail =
    opts?.storageMode === "disk"
      ? " Сейчас медиа пишется на диск сервера (S3_* в .env пустые или DEPLOY_CLOUD_OPTIONAL): проверьте каталог uploads/, права пользователя PM2 и свободное место."
      : opts?.storageMode === "s3"
        ? " Проверьте логи: pm2 logs ping-moot --lines 80 | grep -E 'upload/post-media|S3|PutObject'."
        : "";

  return `Не удалось сохранить файл. Попробуйте ещё раз.${tail}`;
}
