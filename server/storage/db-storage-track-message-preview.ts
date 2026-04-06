/** Подпись пункта трека для сообщения: текст обрезаем, иначе показываем тип. */
export function previewTrackMessageListContent(messageType: string, content: string, maxLen = 200): string {
  return messageType === "text" ? content.slice(0, maxLen) : messageType;
}
