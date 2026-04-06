import type { ContactUser } from "@/lib/users";

/** Как в чате: `@[Имя](publicId)` — сервер `extractMentions` подхватит id. */
export function buildMentionChunk(u: Pick<ContactUser, "displayName" | "surname" | "publicId">): string {
  const label =
    [u.displayName, u.surname].filter(Boolean).join(" ").trim() || `ID ${u.publicId}`;
  const safe = label.replace(/[\]\n]/g, " ").trim() || `ID ${u.publicId}`;
  return `@[${safe}](${u.publicId})`;
}
