export function buildMoneyInviteDmText(opts: {
  template: string;
  codes: string[];
  appLink: string;
}): string {
  const { template, codes, appLink } = opts;
  const n = codes.length;
  const codesBlock = codes.map((c, idx) => `${idx + 1}. ${c}`).join("\n");
  const hadCodesPlaceholder = /\{\{\s*codes\s*\}\}/i.test(template);
  let text = template
    .replace(/\{\{\s*count\s*\}\}/gi, String(n))
    .replace(/\{\{\s*codes\s*\}\}/gi, codesBlock)
    .replace(/\{\{\s*appLink\s*\}\}/gi, appLink)
    .trim();
  if (!hadCodesPlaceholder) {
    const head =
      n === 1
        ? "Вот твой персональный код приглашения (один новый пользователь):"
        : `Вот твои ${n} персональных кода приглашения (каждый на одного нового пользователя):`;
    text = text.length > 0 ? `${text}\n\n${head}\n\n${codesBlock}` : `${head}\n\n${codesBlock}`;
  }
  return text;
}
