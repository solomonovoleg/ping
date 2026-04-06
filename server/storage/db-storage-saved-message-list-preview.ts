/** Превью текста в списке сохранённых (как раньше: не-text → тип, text → обрезка). */
export function previewSavedMessageListContent(messageType: string, content: string, maxLen = 150): string {
  return messageType === "text" ? content.slice(0, maxLen) : messageType;
}
