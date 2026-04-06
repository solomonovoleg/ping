import type { PushTtlValue } from "@shared/schema/push-feed";

/** Срок жизни Push в формах (как при создании поста). */
export const PUSH_FORM_TTL_OPTIONS: Array<{ value: PushTtlValue; label: string }> = [
  { value: "12h", label: "12 ч" },
  { value: "24h", label: "24 ч" },
  { value: "48h", label: "48 ч" },
  { value: "56h", label: "56 ч" },
  { value: "forever", label: "Бессрочно" },
];

/** Ориентир «до 5 строк» в компактном поле. */
export const STANDALONE_PUSH_TEXT_MAX_LENGTH = 720;
