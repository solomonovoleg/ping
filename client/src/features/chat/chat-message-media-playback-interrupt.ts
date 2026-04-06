/**
 * Координация: перед записью голоса или видеокружка останавливаем все воспроизведения
 * голосовых/видео в ленте чата (иначе микрофон и динамик работают одновременно).
 */
const pausers = new Set<() => void>();

export function requestPauseChatMessageMediaPlayback(): void {
  for (const pause of pausers) {
    try {
      pause();
    } catch {
      /* ignore */
    }
  }
}

export function registerChatMessageMediaPlaybackPauser(pause: () => void): () => void {
  pausers.add(pause);
  return () => {
    pausers.delete(pause);
  };
}
