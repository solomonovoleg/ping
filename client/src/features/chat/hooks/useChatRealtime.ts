import { useRealtimeContext } from "@/contexts/RealtimeContext";
import {
  emitChatListUpdate,
  onChatRead,
  onMessageEdited,
  onMessageReaction,
  onRealtimeSocketConnected,
} from "@/features/chat/realtime-events";

export function useChatRealtime() {
  const {
    subscribeChat,
    subscribeMessageDeleted,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
    sendComposerPulse,
    subscribeComposerPulse,
    sendMarkChatRead,
    sendSubscribeChatThread,
    sendUnsubscribeChatThread,
  } = useRealtimeContext();

  return {
    subscribeChat,
    subscribeMessageDeleted,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
    sendComposerPulse,
    subscribeComposerPulse,
    sendMarkChatRead,
    sendSubscribeChatThread,
    sendUnsubscribeChatThread,
    notifyChatListUpdate: emitChatListUpdate,
    onChatRead,
    onMessageReaction,
    onMessageEdited,
    onRealtimeSocketConnected,
  };
}
