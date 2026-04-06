/** Десктоп: правая панель «Быстрые действия» → открыть дроер создания Push в `Chats`. */
export const OPEN_CREATE_STANDALONE_PUSH_EVENT = "ping:open-create-standalone-push";

export function requestOpenCreateStandalonePushDrawer(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_CREATE_STANDALONE_PUSH_EVENT));
}
