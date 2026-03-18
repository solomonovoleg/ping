import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import { createPost, uploadPostMedia, resolveUrl } from "../lib/api";
import { UserAvatar } from "../components/UserAvatar";
import { colors, spacing, radius } from "../theme";

export default function CreatePostScreen() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Нужен доступ к фото", "Разрешите доступ к галерее в настройках.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setImageUri(result.assets[0].uri);
    setUploading(true);
    try {
      const file = {
        uri: result.assets[0].uri,
        name: "image.jpg",
        type: "image/jpeg" as const,
      };
      const url = await uploadPostMedia(file);
      setImageUrl(url);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageUrl(null);
  };

  const publish = async () => {
    const t = text.trim();
    if (!t) {
      Alert.alert("", "Введите текст записи");
      return;
    }
    setPublishing(true);
    try {
      await createPost({ text: t, imageUrl: imageUrl ?? undefined });
      router.replace("/(tabs)/feed");
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось опубликовать");
    } finally {
      setPublishing(false);
    }
  };

  const displayName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") : "";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelBtn}>Отмена</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новая запись</Text>
        <TouchableOpacity
          onPress={publish}
          disabled={publishing}
          style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
        >
          {publishing ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.publishBtnText}>Опубликовать</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.authorRow}>
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            displayName={displayName || "Вы"}
            seed={user?.id ?? "me"}
            size={44}
          />
          <Text style={styles.authorName}>{displayName || "Вы"}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Что у вас нового?"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />
        {(imageUri || imageUrl) && (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri ?? resolveUrl(imageUrl) ?? undefined }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            {!uploading && (
              <TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        )}
        <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage} disabled={uploading}>
          <Text style={styles.addPhotoIcon}>🖼</Text>
          <Text style={styles.addPhotoText}>Добавить фото</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.space4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelBtn: { fontSize: 16, color: colors.foreground, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  publishBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: { fontSize: 15, fontWeight: "600", color: colors.primaryForeground },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.space4, paddingBottom: 40 },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.space3, gap: spacing.space2 },
  authorName: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  input: {
    minHeight: 120,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: 8,
  },
  imageWrap: { position: "relative", marginTop: spacing.space3, borderRadius: radius.xl, overflow: "hidden" },
  previewImage: { width: "100%", height: 280, borderRadius: radius.xl },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: radius.lg,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageText: { color: "#fff", fontSize: 14 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.space4,
    paddingVertical: 12,
    gap: 8,
  },
  addPhotoIcon: { fontSize: 22 },
  addPhotoText: { fontSize: 16, color: colors.primary, fontWeight: "500" },
});
