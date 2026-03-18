import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getChats, type ChatItem } from "../../lib/api";
import { UserAvatar } from "../../components/UserAvatar";
import { colors, spacing, radius } from "../../theme";

function formatChatTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800000) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getChats()
      .then((list) => { if (!cancelled) setChats(list); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredChats =
    searchLower === ""
      ? chats
      : chats.filter((c) => (c.name ?? "").toLowerCase().includes(searchLower));

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Чаты</Text>
          <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Изменить">
            <Ionicons name="pencil-outline" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по номеру, ID или имени..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.contactsBtn} accessibilityLabel="Контакты">
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Загрузка чатов...</Text>
        </View>
      ) : filteredChats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>
            {chats.length === 0 ? "У вас пока нет чатов" : "Нет чатов по запросу"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {chats.length === 0
              ? "Найдите пользователя через поиск выше и начните диалог"
              : "Измените поиск или выберите другой фильтр"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
              activeOpacity={0.7}
            >
              <UserAvatar
                avatarUrl={item.otherMemberAvatarUrl}
                displayName={item.name ?? "Чат"}
                seed={item.id}
                size={48}
              />
              <View style={styles.chatBody}>
                <View style={styles.chatRowTop}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {item.name ?? (item.type === "dm" ? "Диалог" : "Чат")}
                  </Text>
                  <Text style={styles.chatTime}>{formatChatTime(item.createdAt)}</Text>
                </View>
                <Text style={styles.chatPreview}>Нет сообщений</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.space5 },
  header: {
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    paddingBottom: spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.space2,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.foreground },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.space2 },
  searchInput: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.foreground,
  },
  contactsBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  contactsBtnText: { fontSize: 16 },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.mutedForeground },
  errorText: { fontSize: 14, color: colors.destructive },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.space5, minHeight: 200 },
  emptyIcon: { fontSize: 56, marginBottom: spacing.space4, opacity: 0.3 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
  listContent: { paddingHorizontal: spacing.space3, paddingVertical: spacing.space2, paddingBottom: 24 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.xl,
    minHeight: 52,
    gap: 12,
  },
  chatBody: { flex: 1, minWidth: 0 },
  chatRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  chatName: { fontSize: 15, fontWeight: "600", color: colors.foreground, flex: 1 },
  chatTime: { fontSize: 11, color: colors.mutedForeground },
  chatPreview: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
