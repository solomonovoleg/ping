import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchUserProfile,
  fetchPostsByAuthor,
  formatPostTime,
  addReaction,
  removeReaction,
  resolveUrl,
  type PublicProfile,
  type FeedPost,
} from "../../lib/api";
import { colors, spacing, radius } from "../../theme";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);

  const rawId = typeof id === "string" ? id : Array.isArray(id) ? (id[0] ?? "") : "";
  const normalizedRouteId = rawId.trim().replace(/^@+/, "");
  const isMe = useMemo(() => {
    const seg = rawId.trim();
    if (!seg) return false;
    if (seg.toLowerCase() === "me") return true;
    if (authLoading || !user) return false;
    return /^\d+$/u.test(normalizedRouteId) && normalizedRouteId === String(user.publicId);
  }, [rawId, normalizedRouteId, user, authLoading]);

  const profileId = isMe ? (user?.id ?? "") : rawId;

  const load = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    try {
      const p = await fetchUserProfile(profileId);
      setProfile(p ?? null);
      if (p) {
        const list = await fetchPostsByAuthor(p.id, 50);
        setPosts(list);
      } else {
        setPosts([]);
      }
    } catch {
      setProfile(null);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleReaction = async (postId: string, emoji: string | null) => {
    setReactionPickerPostId(null);
    try {
      if (emoji) await addReaction(postId, emoji);
      else await removeReaction(postId);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const reactions = emoji
            ? [...(p.reactions || []).filter((r) => r.emoji !== (p.myReaction ?? "")), { emoji, count: (p.reactions?.find((r) => r.emoji === emoji)?.count ?? 0) + 1 }]
            : (p.reactions || []).map((r) => (r.emoji === p.myReaction ? { ...r, count: r.count - 1 } : r)).filter((r) => r.count > 0);
          return {
            ...p,
            myReaction: emoji ?? undefined,
            reactions: reactions as { emoji: string; count: number }[],
          };
        })
      );
    } catch (e) {
      if (__DEV__ && typeof console !== "undefined") console.warn("Profile reaction", e);
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile && !isMe) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Профиль не найден</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = profile
    ? [profile.displayName, profile.surname].filter(Boolean).join(" ") || `ID ${profile.publicId}`
    : user
      ? [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль"
      : "Профиль";

  const avatarUrl = profile?.avatarUrl ? resolveUrl(profile.avatarUrl) : null;

  const renderPost = ({ item }: { item: FeedPost }) => {
    const imageUri = item.imageUrl ? resolveUrl(item.imageUrl) : null;
    const totalReactions = (item.reactions ?? []).reduce((s, r) => s + r.count, 0);

    return (
      <View style={styles.post}>
        <Text style={styles.postText}>{item.text}</Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.postImage} resizeMode="cover" />
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.reactionPill, item.myReaction && styles.reactionPillActive]}
            onPress={() => {
              if (item.myReaction) handleReaction(item.id, null);
              else setReactionPickerPostId(reactionPickerPostId === item.id ? null : item.id);
            }}
          >
            {item.myReaction && <Text style={styles.emojiSmall}>{item.myReaction}</Text>}
            {totalReactions > 0 && <Text style={styles.reactionCount}>{totalReactions}</Text>}
          </TouchableOpacity>
          {reactionPickerPostId === item.id && (
            <View style={styles.emojiPicker}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleReaction(item.id, emoji)}
                  style={styles.emojiBtn}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={styles.commentsBtn}
            onPress={() => router.push(`/comments/${item.id}`)}
          >
            <Text style={styles.commentsIcon}>💬</Text>
            <Text style={styles.commentsCount}>{item.commentsCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        {isMe && (
          <TouchableOpacity onPress={() => router.push("/(tabs)/settings")}>
            <Text style={styles.settingsText}>Настройки</Text>
          </TouchableOpacity>
        )}
        {!isMe && <View style={styles.backBtn} />}
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.profileCard}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name}>{displayName}</Text>
            {profile && (
              <View style={styles.stats}>
                <Text style={styles.statValue}>{profile.postsCount}</Text>
                <Text style={styles.statLabel}>записей</Text>
                <Text style={styles.statValue}>{profile.reactionsCount}</Text>
                <Text style={styles.statLabel}>реакций</Text>
                <Text style={styles.statValue}>{profile.commentsCount}</Text>
                <Text style={styles.statLabel}>коммент.</Text>
              </View>
            )}
          </View>
        }
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет записей</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { fontSize: 15, color: colors.mutedForeground },
  backLink: { marginTop: 16 },
  backLinkText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: { minWidth: 80 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: colors.foreground, textAlign: "center" },
  settingsText: { fontSize: 15, color: colors.primary, fontWeight: "500" },
  profileCard: {
    alignItems: "center",
    paddingVertical: spacing.space6,
    paddingHorizontal: spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius["2xl"],
    marginBottom: spacing.space3,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: { color: colors.primaryForeground, fontSize: 32, fontWeight: "600" },
  name: { fontSize: 20, fontWeight: "600", color: colors.foreground },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.space3,
    gap: spacing.space4,
  },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  statLabel: { fontSize: 13, color: colors.mutedForeground },
  listContent: { paddingBottom: spacing.space6 },
  post: {
    padding: spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  postText: { fontSize: 15, color: colors.foreground, lineHeight: 22, marginBottom: spacing.space2 },
  postImage: { width: "100%", height: 240, borderRadius: radius.xl, marginBottom: spacing.space2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionPillActive: { backgroundColor: colors.primary + "18", borderColor: colors.primary + "50" },
  emojiSmall: { fontSize: 16, marginRight: 4 },
  reactionCount: { fontSize: 13, color: colors.mutedForeground },
  emojiPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiBtn: { padding: 4 },
  emojiText: { fontSize: 20 },
  commentsBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentsIcon: { fontSize: 16 },
  commentsCount: { fontSize: 14, color: colors.mutedForeground },
  empty: { padding: spacing.space6, alignItems: "center" },
  emptyText: { fontSize: 15, color: colors.mutedForeground },
});
