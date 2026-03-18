import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchFeed,
  formatPostTime,
  addReaction,
  removeReaction,
  resolveUrl,
  type FeedPost,
} from "../../lib/api";
import { UserAvatar } from "../../components/UserAvatar";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "../../theme";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchFeed(80);
      setPosts(list);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleReaction = async (postId: string, emoji: string | null) => {
    setReactionPickerPostId(null);
    setReactingId(postId);
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
    } finally {
      setReactingId(null);
    }
  };

  const openProfile = (authorId: string, publicId: number) => {
    if (authorId === user?.id) router.push("/profile/me");
    else router.push(`/profile/${publicId}`);
  };

  const currentUserName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль" : "Профиль";

  const renderPost = ({ item }: { item: FeedPost }) => {
    const imageUri = item.imageUrl ? resolveUrl(item.imageUrl) : null;
    const totalReactions = (item.reactions ?? []).reduce((s, r) => s + r.count, 0);

    return (
      <View style={styles.post}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postAuthor}
            onPress={() => openProfile(item.authorId, item.author.publicId)}
          >
            <UserAvatar
              avatarUrl={item.author?.avatarUrl}
              displayName={item.channelName}
              seed={item.authorId}
              size={40}
            />
            <View style={styles.postAuthorInfo}>
              <Text style={styles.authorName}>{item.channelName}</Text>
              <Text style={styles.postTime}>{formatPostTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.postText}>{item.text}</Text>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={styles.postImage} resizeMode="cover" />
        )}
        <View style={styles.actions}>
          <View style={styles.reactionsRow}>
            <TouchableOpacity
              style={[styles.reactionPill, item.myReaction && styles.reactionPillActive]}
              onPress={() => {
                if (item.myReaction) handleReaction(item.id, null);
                else setReactionPickerPostId(reactionPickerPostId === item.id ? null : item.id);
              }}
            >
              {item.myReaction && <Text style={styles.emojiSmall}>{item.myReaction}</Text>}
              {totalReactions > 0 && (
                <Text style={styles.reactionCount}>{totalReactions}</Text>
              )}
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
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Лента</Text>
        <TouchableOpacity onPress={() => router.push("/profile/me")}>
          <Text style={styles.headerProfile} numberOfLines={1}>
            {currentUserName}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/create-post")}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View style={styles.storiesWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesScroll}
              >
                <TouchableOpacity style={styles.storyItem}>
                  <View style={styles.storyRing}>
                    <UserAvatar
                      avatarUrl={user?.avatarUrl}
                      displayName={currentUserName}
                      seed={user?.id ?? "me"}
                      size={56}
                    />
                    <View style={styles.storyPlus}>
                      <Ionicons name="add" size={16} color="#fff" />
                    </View>
                  </View>
                  <Text style={styles.storyLabel} numberOfLines={1}>Моя история</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Пока нет постов</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: colors.foreground },
  headerProfile: { fontSize: 15, fontWeight: "600", color: colors.primary, maxWidth: 120 },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  storiesWrap: {
    paddingVertical: spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  storiesScroll: { paddingHorizontal: spacing.space4, gap: spacing.space4 },
  storyItem: { alignItems: "center", marginRight: spacing.space4 },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  storyPlus: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  storyLabel: { fontSize: 12, color: colors.foreground, marginTop: 6, maxWidth: 70 },
  listContent: { paddingBottom: spacing.space6 },
  post: {
    padding: spacing.space4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.space2 },
  postAuthor: { flexDirection: "row", alignItems: "center", flex: 1 },
  postAuthorInfo: { marginLeft: spacing.space2 },
  authorName: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  postTime: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  postText: { fontSize: 15, color: colors.foreground, lineHeight: 22, marginBottom: spacing.space2 },
  postImage: { width: "100%", height: 240, borderRadius: radius.xl, marginBottom: spacing.space2 },
  actions: { flexDirection: "row", alignItems: "center", marginTop: spacing.space1 },
  reactionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  commentsBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 8 },
  commentsIcon: { fontSize: 16 },
  commentsCount: { fontSize: 14, color: colors.mutedForeground },
  empty: { padding: spacing.space6, alignItems: "center" },
  emptyText: { fontSize: 15, color: colors.mutedForeground },
});
