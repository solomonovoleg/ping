import { useRealtimeContext } from "@/contexts/RealtimeContext";
import {
  emitChatListUpdate,
  onChatRead,
  onMessageEdited,
  onMessageReaction,
} from "@/features/chat/realtime-events";

export function useChatRealtime() {
  const { subscribeChat, subscribeMessageDeleted, sendTyping, subscribeTyping, sendVoiceRecording, subscribeVoiceRecording } =
    useRealtimeContext();

  return {
    subscribeChat,
    subscribeMessageDeleted,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
    notifyChatListUpdate: emitChatListUpdate,
    onChatRead,
    onMessageReaction,
    onMessageEdited,
  };
}
