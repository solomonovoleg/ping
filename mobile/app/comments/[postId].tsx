import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchComments,
  createComment,
  formatCommentTime,
  type CommentItem,
} from "../../lib/api";
import { colors, spacing, radius } from "../../theme";

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const list = await fetchComments(postId);
      setComments(list);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const t = text.trim();
    if (!t || !postId || !user || sending) return;
    setSending(true);
    setText("");
    try {
      const created = await createComment(postId, t);
      if (created) setComments((prev) => [created, ...prev]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Комментарии</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Загрузка…</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.comment}>
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>{(item.user || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.commentUser}>{item.user}</Text>
                <Text style={styles.commentText}>{item.text}</Text>
                <Text style={styles.commentTime}>{formatCommentTime(item.createdAt)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Пока нет комментариев</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Написать комментарий..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={send}
          disabled={sending}
        >
          <Text style={styles.sendBtnText}>Отпр.</Text>
        </TouchableOpacity>
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
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  list: { flex: 1 },
  listContent: { padding: spacing.space4, paddingBottom: 24 },
  comment: { flexDirection: "row", marginBottom: spacing.space4 },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.space2,
  },
  commentAvatarText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "600" },
  commentBody: { flex: 1 },
  commentUser: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  commentText: { fontSize: 15, color: colors.foreground, marginTop: 2 },
  commentTime: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  empty: { padding: spacing.space6, alignItems: "center" },
  emptyText: { fontSize: 15, color: colors.mutedForeground },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
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
  sendBtn: {
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: colors.primaryForeground, fontWeight: "600" },
});
