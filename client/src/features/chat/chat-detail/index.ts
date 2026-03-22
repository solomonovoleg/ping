/**
 * Вынесенные из `pages/ChatDetail.tsx` куски без контракта send/actions.
 * Основной экран чата по-прежнему в `ChatDetail.tsx`; см. docs/CHAT_DETAIL_RULES.md.
 */
export type { ChatPlatformKind, ChatBackgroundPreset, ChatMessageBubblePreset } from "./chat-appearance-presets";
export {
  CHAT_BG_STORAGE_PREFIX,
  CHAT_MSG_COLOR_STORAGE_PREFIX,
  CHAT_BG_PRESETS,
  MSG_BUBBLE_PRESETS,
  isChatBackgroundPreset,
  getChatBackgroundStorageKey,
  isChatMessageBubblePreset,
  getChatMsgColorStorageKey,
  detectChatPlatform,
} from "./chat-appearance-presets";
export { useChatSpacingPreset } from "./useChatSpacingPreset";
export { formatVideoNoteTime } from "./format-video-note-time";
export { RecordingStrip } from "./RecordingStrip";
export { AiChatView } from "./AiChatView";
export { ChatDetailAppearancePanel } from "./ChatDetailAppearancePanel";
export type { ChatAppearanceBgLayout, ChatDetailAppearancePanelProps } from "./ChatDetailAppearancePanel";
export { ChatDetailLifecycleSection } from "./ChatDetailLifecycleSection";
export { ChatDetailOverflowMenuShell, ChatDetailGroupMenuBody } from "./ChatDetailOverflowMenus";
export type { ChatDetailGroupMenuBodyProps } from "./ChatDetailOverflowMenus";
export { ChatDetailGroupFolderStrip, ChatDetailGroupCallLobbyBanner } from "./ChatDetailGroupChrome";
export type { ChatDetailGroupFolderTab } from "./ChatDetailGroupChrome";
export { ChatDetailMessageSelectionBar } from "./ChatDetailMessageSelectionBar";
export { ChatDetailOlderMessagesLoadingRow, ChatDetailMessagesEmptyState } from "./ChatDetailMessageListStates";
export { ChatDetailMessageDatePill } from "./ChatDetailMessageDatePill";
export { ChatDetailComposerTopChrome, ChatDetailComposerReplyDraftStrips } from "./ChatDetailComposerStrips";
export { ChatDetailNativeAttachMenu, ChatDetailComposerSpellFooter } from "./ChatDetailComposerExtras";
export { ChatDetailVoicePreviewModal, ChatDetailVideoNoteModal } from "./ChatDetailMediaPreviewModals";
export type { ChatDetailVideoNotePhase } from "./ChatDetailMediaPreviewModals";
