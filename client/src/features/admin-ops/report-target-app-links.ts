export type ReportTargetLinkContext = {
  contextPostId?: string | null;
  contextChatId?: string | null;
};

/**
 * Относительные пути в SPA для модератора. Без сохранённого контекста (старые жалобы) — null там, где нужен пост/чат.
 */
export function reportTargetAppPath(
  targetType: string,
  targetId: string,
  ctx?: ReportTargetLinkContext,
): string | null {
  const id = targetId?.trim();
  if (!id) return null;
  const enc = encodeURIComponent(id);
  switch (targetType) {
    case "post":
      return `/u/me/p/${enc}`;
    case "user":
      return `/id/${enc}`;
    case "comment": {
      const post = ctx?.contextPostId?.trim();
      if (!post) return null;
      return `/u/me/p/${encodeURIComponent(post)}?commentId=${enc}`;
    }
    case "message": {
      const chat = ctx?.contextChatId?.trim();
      if (!chat) return null;
      return `/chat/${encodeURIComponent(chat)}`;
    }
    case "story":
      /** Лента обрабатывает `?storyId=` и при необходимости догружает сторис по API (см. Posts). */
      return `/posts?storyId=${enc}`;
    default:
      return null;
  }
}

export function reportTargetOpenHint(targetType: string, ctx?: ReportTargetLinkContext): string | null {
  switch (targetType) {
    case "message":
      return ctx?.contextChatId?.trim()
        ? null
        : "ID чата не сохранён (старая жалоба): найдите сообщение по БД.";
    case "story":
      return "Откроется /posts с этой сторис (нужна авторизация и права видимости контента, как у пользователя).";
    case "comment":
      return ctx?.contextPostId?.trim()
        ? null
        : "ID поста не сохранён (старая жалоба): найдите пост по связи comment→post.";
    default:
      return null;
  }
}
