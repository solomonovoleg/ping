import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
  Alert,
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
  type ChatDetail,
  type Message,
} from "../../lib/api";
import { VoiceMessagePlayer } from "../../components/VoiceMessagePlayer";
import { UserAvatar } from "../../components/UserAvatar";
import { colors, spacing, radius } from "../../theme";
import { getMobileCallCapabilities } from "../../lib/call-capabilities";

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

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, m] = await Promise.all([getChat(id), getMessages(id)]);
      setChat(c);
      setMessages(m);
      const last = m.length > 0 ? m[m.length - 1] : null;
      if (last?.id && !String(last.id).startsWith("temp-")) {
        await markChatRead(id, last.id);
      }
    } catch {
      setChat(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t || !id || sending) return;
    setSending(true);
    setText("");
    try {
      const msg = await sendMessage(id, t);
      setMessages((prev) => [...prev, msg]);
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
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
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось начать запись. Проверьте разрешение микрофона.");
    }
  };

  const stopRecordingAndSend = async () => {
    const rec = recordingRef.current;
    if (!rec || !id || !user) {
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
      setMessages((prev) => [...prev, msg]);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отправить голосовое");
    } finally {
      setSendingVoice(false);
    }
  };

  const pickImage = async () => {
    if (!id || !user || sendingMedia) return;
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
      setMessages((prev) => [...prev, msg]);
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

  const callPhone = () => {
    const phone = chat?.otherMember?.phone;
    const caps = getMobileCallCapabilities();
    if (!phone) return;
    if (caps.fallbackMode === "tel") {
      Linking.openURL(`tel:${phone}`);
    }
  };

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
        {chat.otherMember?.phone ? (
          <TouchableOpacity onPress={callPhone}>
            <Text style={styles.callText}>Позвонить</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={renderMessage}
      />

      <View style={styles.inputRow}>
        <TouchableOpacity
          onPress={pickImage}
          style={styles.attachBtn}
          disabled={sendingMedia}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Сообщение..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
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
  headerBtn: { minWidth: 80 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground, flex: 1 },
  callText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
