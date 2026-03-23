import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
  AppState,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { useAuth } from "../../contexts/AuthContext";
import {
  getChat,
  getMessages,
  sendMessage,
  markChatRead,
  uploadVoice,
  uploadChatMedia,
  resolveUrl,
  setUserBlockFlags,
  removeUserBlock,
  deleteChatForMe,
  type ChatDetail,
  type Message,
} from "../../lib/api";
import { VoiceMessagePlayer } from "../../components/VoiceMessagePlayer";
import { UserAvatar } from "../../components/UserAvatar";
import { DmBlockedComposer } from "../../components/DmBlockedComposer";
import { buildMentionList, memberDisplayName, type GroupChatMember } from "../../lib/group-mention-utils";
import { colors, spacing, radius } from "../../theme";
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const textRef = useRef("");
  const inputRef = useRef<TextInput | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const mentionStartRef = useRef(0);
  const mentionQueryRef = useRef("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, m] = await Promise.all([getChat(id), getMessages(id)]);
      setChat(c);
      setMessages(m);
      const skipReadAdvance = new Set(["system", "missed_call"]);
      const uid = user?.id ?? null;
      const lastIncoming = [...m].reverse().find(
        (msg) =>
          Boolean(msg.id) &&
          !String(msg.id).startsWith("temp-") &&
          !skipReadAdvance.has(msg.type) &&
          (!uid || msg.senderId !== uid),
      );
      if (lastIncoming?.id) {
        await markChatRead(id, lastIncoming.id);
      }
    } catch {
      setChat(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  const refreshChatOnly = useCallback(async () => {
    if (!id) return;
    try {
      const c = await getChat(id);
      setChat(c);
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refreshChatOnly();
    });
    return () => sub.remove();
  }, [refreshChatOnly]);

  useEffect(() => {
    textRef.current = "";
    setText("");
    setMentionOpen(false);
    setMentionQuery("");
  }, [id]);

  const mentionMembersForPicker = useMemo((): GroupChatMember[] => {
    if (!chat || chat.type !== "group") return [];
    const fromApi = chat.members ?? [];
    if (fromApi.length > 0) return fromApi;
    const byId = new Map<string, GroupChatMember>();
    for (const msg of messages) {
      if (!msg.senderId || msg.type === "system" || msg.type === "missed_call") continue;
      if (byId.has(msg.senderId)) continue;
      byId.set(msg.senderId, {
        id: msg.senderId,
        displayName: null,
        surname: null,
        avatarUrl: null,
      });
    }
    return Array.from(byId.values());
  }, [chat, messages]);

  const runMentionCheck = useCallback(
    (value: string, cursor: number) => {
      if (chat?.type !== "group") {
        setMentionOpen(false);
        return;
      }
      const beforeCursor = value.slice(0, cursor);
      const lastAt = Math.max(beforeCursor.lastIndexOf("@"), beforeCursor.lastIndexOf("\uFF20"));
      if (lastAt >= 0) {
        const afterAt = beforeCursor.slice(lastAt + 1);
        if (!/[\s\n]/.test(afterAt)) {
          mentionStartRef.current = lastAt;
          mentionQueryRef.current = afterAt;
          setMentionQuery(afterAt);
          setMentionOpen(true);
          return;
        }
      }
      setMentionOpen(false);
    },
    [chat?.type],
  );

  const commitMention = useCallback((mentionText: string) => {
    const value = textRef.current;
    const start = mentionStartRef.current;
    const q = mentionQueryRef.current;
    const spanEnd = start + 1 + q.length;
    const newText = value.slice(0, start) + mentionText + value.slice(spanEnd);
    textRef.current = newText;
    setText(newText);
    setMentionOpen(false);
    const c = start + mentionText.length;
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ selection: { start: c, end: c } });
    });
  }, []);

  const onComposerChangeText = useCallback(
    (value: string) => {
      textRef.current = value;
      setText(value);
      if (chat?.type === "group") {
        runMentionCheck(value, value.length);
      } else {
        setMentionOpen(false);
      }
    },
    [chat?.type, runMentionCheck],
  );

  const onComposerSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const cursor = e.nativeEvent.selection.end;
      runMentionCheck(textRef.current, cursor);
    },
    [runMentionCheck],
  );

  useEffect(() => {
    if (!mentionOpen || chat?.type !== "group") return;
    if ((chat.members?.length ?? 0) > 0) return;
    void refreshChatOnly();
  }, [mentionOpen, chat?.type, chat?.members?.length, refreshChatOnly]);

  const mentionRows = useMemo(
    () => buildMentionList(mentionMembersForPicker, mentionQuery, { includeEveryone: true }),
    [mentionMembersForPicker, mentionQuery],
  );

  const blockedByPeer =
    chat?.type === "dm" && chat.blockedByOther?.restrictChat === true;
  const iBlockedThem =
    chat?.type === "dm" &&
    !!(chat.myBlockOfOther?.restrictChat || chat.myBlockOfOther?.restrictProfile || chat.myBlockOfOther?.restrictSocial);

  const confirmDeleteForMe = () => {
    if (!id) return;
    Alert.alert("Удалить чат у себя?", "Диалог пропадёт из списка.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => {
          void deleteChatForMe(id)
            .then(() => router.back())
            .catch((e) => Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось"));
        },
      },
    ]);
  };

  const afterBlockOfferDelete = () => {
    if (!id) return;
    Alert.alert("Пользователь заблокирован", "Удалить чат у себя?", [
      { text: "Нет, оставить", style: "cancel" },
      {
        text: "Да, удалить",
        style: "destructive",
        onPress: () => {
          void deleteChatForMe(id)
            .then(() => router.back())
            .catch((e) => Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось"));
        },
      },
    ]);
  };

  const openDmMenu = () => {
    if (!chat || chat.type !== "dm" || !chat.otherMember?.id || !id) return;
    const oid = chat.otherMember.id;

    const unblock = () => {
      Alert.alert("Снять блокировку?", "Снимутся все ваши ограничения для этого контакта.", [
        { text: "Отмена", style: "cancel" },
        {
          text: "Снять",
          onPress: () => {
            void removeUserBlock(oid)
              .then(() => refreshChatOnly())
              .catch((e) => Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось"));
          },
        },
      ]);
    };

    const blockChatOnly = () => {
      void setUserBlockFlags(oid, {
        restrictProfile: false,
        restrictChat: true,
        restrictSocial: false,
      })
        .then(() => refreshChatOnly().then(() => afterBlockOfferDelete()))
        .catch((e) => Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось"));
    };

    const blockFull = () => {
      void setUserBlockFlags(oid, {
        restrictProfile: true,
        restrictChat: true,
        restrictSocial: true,
      })
        .then(() => refreshChatOnly().then(() => afterBlockOfferDelete()))
        .catch((e) => Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось"));
    };

    if (Platform.OS === "ios") {
      if (iBlockedThem) {
        const opts = ["Снять блокировку", "Удалить чат у себя", "Отмена"];
        const cancel = opts.length - 1;
        ActionSheetIOS.showActionSheetWithOptions(
          { options: opts, cancelButtonIndex: cancel, destructiveButtonIndex: opts.indexOf("Удалить чат у себя") },
          (i) => {
            const opt = opts[i];
            if (opt === "Снять блокировку") unblock();
            else if (opt === "Удалить чат у себя") confirmDeleteForMe();
          },
        );
        return;
      }
      const opts = [
        "Заблокировать: только переписка",
        "Заблокировать: полностью",
        "Удалить чат у себя",
        "Отмена",
      ];
      const cancel = opts.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: opts,
          cancelButtonIndex: cancel,
          destructiveButtonIndex: opts.indexOf("Удалить чат у себя"),
        },
        (i) => {
          const opt = opts[i];
          if (opt === "Заблокировать: только переписка") blockChatOnly();
          else if (opt === "Заблокировать: полностью") blockFull();
          else if (opt === "Удалить чат у себя") confirmDeleteForMe();
        },
      );
      return;
    }

    const buttons: {
      text: string;
      style?: "destructive" | "cancel";
      onPress?: () => void;
    }[] = [];
    if (iBlockedThem) {
      buttons.push({ text: "Снять блокировку", onPress: () => unblock() });
    } else {
      buttons.push({ text: "Заблокировать: только переписка", onPress: () => blockChatOnly() });
      buttons.push({ text: "Заблокировать: полностью", onPress: () => blockFull() });
    }
    buttons.push({ text: "Удалить чат у себя", style: "destructive", onPress: () => confirmDeleteForMe() });
    buttons.push({ text: "Отмена", style: "cancel" });
    Alert.alert("Чат", undefined, buttons);
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !id || sending || blockedByPeer) return;
    const prev = text;
    setSending(true);
    setText("");
    textRef.current = "";
    setMentionOpen(false);
    try {
      const msg = await sendMessage(id, t);
      setMessages((p) => [...p, msg]);
    } catch (e) {
      setText(prev);
      Alert.alert("Не отправлено", e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (blockedByPeer) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(true);
    } catch {
      Alert.alert("Ошибка", "Не удалось начать запись. Проверьте разрешение микрофона.");
    }
  };

  const stopRecordingAndSend = async () => {
    const rec = recordingRef.current;
    if (!rec || !id || !user || blockedByPeer) {
      setRecording(false);
      return;
    }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setRecording(false);
      if (!uri) return;
      setSendingVoice(true);
      const file = { uri, name: "voice.m4a", type: "audio/mp4" as const };
      const url = await uploadVoice(file);
      const msg = await sendMessage(id, url, "voice");
      setMessages((p) => [...p, msg]);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отправить голосовое");
    } finally {
      setSendingVoice(false);
    }
  };

  const pickImage = async () => {
    if (!id || !user || sendingMedia || blockedByPeer) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Нужен доступ к фото", "Разрешите доступ к галерее в настройках.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setSendingMedia(true);
    try {
      const asset = result.assets[0];
      const file = { uri: asset.uri, name: "image.jpg", type: "image/jpeg" as const };
      const url = await uploadChatMedia(file);
      const msg = await sendMessage(id, url, "image");
      setMessages((p) => [...p, msg]);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отправить фото");
    } finally {
      setSendingMedia(false);
    }
  };

  const displayName =
    chat?.name ??
    (chat?.otherMember
      ? [chat.otherMember.displayName, chat.otherMember.surname].filter(Boolean).join(" ")
      : null) ??
    "Чат";

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;
    const audioUri = item.type === "voice" ? resolveUrl(item.content) : null;
    const imageUri = item.type === "image" ? resolveUrl(item.content) : null;

    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {item.type === "text" && (
          <Text style={isMe ? styles.bubbleTextMe : styles.bubbleText}>{item.content}</Text>
        )}
        {item.type === "voice" && (
          audioUri ? <VoiceMessagePlayer uri={audioUri} isMe={isMe} /> : (
            <Text style={[isMe ? styles.bubbleTextMe : styles.bubbleText, { fontSize: 12 }]}>Голосовое (недоступно)</Text>
          )
        )}
        {item.type === "image" && imageUri && (
          <Image source={{ uri: imageUri }} style={styles.bubbleImage} resizeMode="cover" />
        )}
        {(item.type === "video" || (item.type !== "text" && item.type !== "voice" && item.type !== "image")) && (
          <Text style={isMe ? styles.bubbleTextMe : styles.bubbleText}>[Медиа]</Text>
        )}
      </View>
    );
  };

  if (loading || !chat) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{loading ? "Загрузка..." : "Чат не найден"}</Text>
      </View>
    );
  }

  const isDm = chat.type === "dm";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <UserAvatar
            avatarUrl={chat.otherMember?.avatarUrl}
            displayName={displayName}
            seed={chat.otherMember?.id ?? chat.id}
            size={32}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isDm && chat.otherMember ? (
            <TouchableOpacity onPress={openDmMenu} style={styles.headerAction} accessibilityLabel="Меню чата">
              <Text style={styles.menuDots}>⋯</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={renderMessage}
      />

      {blockedByPeer ? (
        <DmBlockedComposer note={chat.blockedByOther?.note ?? null} />
      ) : (
        <View style={styles.composerWrap}>
          {mentionOpen && chat.type === "group" ? (
            <View style={styles.mentionPicker}>
              {mentionRows.length === 0 ? (
                <Text style={styles.mentionEmpty}>Нет совпадений — имя или id</Text>
              ) : (
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  data={mentionRows}
                  keyExtractor={(item, index) =>
                    item.kind === "everyone" ? "__everyone__" : `${item.member.id}-${index}`
                  }
                  style={styles.mentionList}
                  nestedScrollEnabled
                  renderItem={({ item }) =>
                    item.kind === "everyone" ? (
                      <TouchableOpacity
                        style={styles.mentionRow}
                        onPress={() => commitMention("@all ")}
                        accessibilityRole="button"
                        accessibilityLabel="Упомянуть всех"
                      >
                        <View style={styles.mentionEveryoneIcon}>
                          <Text style={styles.mentionEveryoneIconText}>@</Text>
                        </View>
                        <Text style={styles.mentionRowTitle}>Все участники</Text>
                        <Text style={styles.mentionRowMeta}>@all</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.mentionRow}
                        onPress={() => {
                          const m = item.member;
                          commitMention(`@[${memberDisplayName(m)}](${m.publicId ?? m.id}) `);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Упомянуть ${memberDisplayName(item.member)}`}
                      >
                        <UserAvatar
                          avatarUrl={item.member.avatarUrl ?? undefined}
                          displayName={memberDisplayName(item.member)}
                          seed={item.member.id}
                          size={32}
                        />
                        <Text style={styles.mentionRowTitle} numberOfLines={1}>
                          {memberDisplayName(item.member)}
                        </Text>
                        {item.member.publicId != null && item.member.publicId > 0 ? (
                          <Text style={styles.mentionRowMeta}>id{item.member.publicId}</Text>
                        ) : null}
                      </TouchableOpacity>
                    )
                  }
                />
              )}
            </View>
          ) : null}
        <View style={styles.inputRow}>
          <TouchableOpacity
            onPress={pickImage}
            style={styles.attachBtn}
            disabled={sendingMedia}
          >
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Сообщение..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={onComposerChangeText}
            onSelectionChange={onComposerSelectionChange}
            onSubmitEditing={send}
            returnKeyType="send"
            editable={!sending}
          />
          {recording ? (
            <TouchableOpacity
              style={[styles.sendBtn, styles.recordBtn]}
              onPress={stopRecordingAndSend}
            >
              <Text style={styles.sendBtnText}>Стоп</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.micBtn, sendingVoice && styles.sendBtnDisabled]}
                onPress={startRecording}
                disabled={sendingVoice}
              >
                <Text style={styles.micIcon}>🎤</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={send}
                disabled={sending}
              >
                <Text style={styles.sendBtnText}>Отпр.</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { fontSize: 15, color: colors.mutedForeground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerBtn: { minWidth: 72 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAction: { minWidth: 40, alignItems: "center", justifyContent: "center" },
  menuDots: { fontSize: 22, color: colors.primary, fontWeight: "700", lineHeight: 24 },
  list: { flex: 1, backgroundColor: colors.secondary + "33" },
  listContent: { padding: 16, paddingBottom: 24, gap: 4 },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.xl,
    marginVertical: 2,
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: colors.foreground },
  bubbleTextMe: { fontSize: 15, color: colors.primaryForeground },
  bubbleImage: { width: 200, height: 200, borderRadius: radius.lg },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  mentionPicker: {
    maxHeight: 220,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  mentionList: { maxHeight: 220 },
  mentionEmpty: {
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space2,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.space4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mentionEveryoneIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  mentionEveryoneIconText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  mentionRowTitle: { flex: 1, fontSize: 15, color: colors.foreground, fontWeight: "500" },
  mentionRowMeta: { fontSize: 12, color: colors.mutedForeground },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    backgroundColor: colors.background,
  },
  attachBtn: { padding: 8 },
  attachIcon: { fontSize: 20 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.foreground,
  },
  micBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  micIcon: { fontSize: 18 },
  sendBtn: {
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
  },
  recordBtn: { backgroundColor: colors.destructive },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: colors.primaryForeground, fontWeight: "600" },
});
