import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Contacts from "expo-contacts";
import { Ionicons } from "@expo/vector-icons";
import {
  addContact,
  listContactsWithProfiles,
  matchContactsFromPhones,
  startDm,
  type ContactPhoneMatchUser,
  type ContactUser,
} from "../lib/api";
import { UserAvatar } from "../components/UserAvatar";
import { colors, spacing, radius } from "../theme";

const MAX_PHONES = 500;

function displayName(c: ContactUser): string {
  const n = [c.displayName, c.surname].filter(Boolean).join(" ").trim();
  return n || `ID ${c.publicId}`;
}

async function gatherPhonesFromDevice(): Promise<string[]> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") return [];
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });
  const out: string[] = [];
  for (const c of data) {
    for (const p of c.phoneNumbers ?? []) {
      const raw = (p.number ?? (p as { digits?: string }).digits ?? "").trim();
      if (raw) out.push(raw);
    }
  }
  return out.slice(0, MAX_PHONES);
}

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const [myContacts, setMyContacts] = useState<ContactUser[]>([]);
  const [bookMatches, setBookMatches] = useState<ContactPhoneMatchUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const loadMyContacts = useCallback(async () => {
    setListError(null);
    try {
      const list = await listContactsWithProfiles();
      setMyContacts(list);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Не удалось загрузить контакты");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadMyContacts();
  }, [loadMyContacts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMyContacts();
    setRefreshing(false);
  }, [loadMyContacts]);

  const syncFromPhoneBook = useCallback(async () => {
    setSyncing(true);
    try {
      const phones = await gatherPhonesFromDevice();
      if (phones.length === 0) {
        setBookMatches([]);
        Alert.alert(
          "Нет номеров",
          "Разрешите доступ к контактам в настройках или проверьте, что в книге есть номера (формат РФ +7)."
        );
        return;
      }
      const matches = await matchContactsFromPhones(phones);
      setBookMatches(matches);
      if (matches.length === 0) {
        Alert.alert(
          "Пока никого нет в Ping",
          "Среди номеров из книги нет зарегистрированных пользователей."
        );
      }
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось проверить контакты");
    } finally {
      setSyncing(false);
    }
  }, []);

  const openChat = async (userId: string) => {
    try {
      const chat = await startDm(userId);
      router.push({ pathname: "/chat/[id]", params: { id: chat.id } });
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось открыть чат");
    }
  };

  const handleAddContact = async (userId: string) => {
    try {
      await addContact(userId);
      await loadMyContacts();
      setBookMatches((prev) => prev.map((u) => (u.id === userId ? { ...u, isInMyContacts: true } : u)));
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось добавить");
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Назад"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Контакты</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="book-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Кто из контактов в Ping</Text>
              <Text style={styles.cardSub}>Синхронизация с телефонной книгой устройства</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={() => void syncFromPhoneBook()}
            disabled={syncing}
            accessibilityLabel="Синхронизировать с телефонной книгой"
          >
            {syncing ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.syncBtnText}>Синхронизировать</Text>
            )}
          </TouchableOpacity>
        </View>

        {bookMatches.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>В Ping из вашей книги</Text>
            {bookMatches.map((m) => (
              <View key={m.id} style={styles.personRow}>
                <TouchableOpacity
                  style={styles.personMain}
                  onPress={() => void openChat(m.id)}
                  activeOpacity={0.7}
                >
                  <UserAvatar
                    avatarUrl={m.avatarUrl}
                    displayName={displayName(m)}
                    seed={m.id}
                    size={48}
                  />
                  <View style={styles.personMeta}>
                    <Text style={styles.personName} numberOfLines={1}>
                      {displayName(m)}
                    </Text>
                    <Text style={styles.personHint}>
                      {m.isInMyContacts ? "Уже в контактах" : "В Ping"}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.personActions}>
                  {!m.isInMyContacts ? (
                    <TouchableOpacity onPress={() => void handleAddContact(m.id)} style={styles.textAction}>
                      <Text style={styles.textActionLabel}>В контакты</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => void openChat(m.id)}
                    style={styles.iconAction}
                    accessibilityLabel={`Написать ${displayName(m)}`}
                  >
                    <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Мои контакты</Text>
          {loadingList ? (
            <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
          ) : listError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{listError}</Text>
              <TouchableOpacity onPress={() => void loadMyContacts()}>
                <Text style={styles.retry}>Повторить</Text>
              </TouchableOpacity>
            </View>
          ) : myContacts.length === 0 ? (
            <Text style={styles.emptyHint}>
              Пока пусто. Синхронизируйте книгу или найдите людей через поиск в чатах.
            </Text>
          ) : (
            myContacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.personRow}
                onPress={() => void openChat(c.id)}
                activeOpacity={0.7}
              >
                <UserAvatar avatarUrl={c.avatarUrl} displayName={displayName(c)} seed={c.id} size={48} />
                <View style={styles.personMeta}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {displayName(c)}
                  </Text>
                  <Text style={styles.personHint}>Нажмите, чтобы написать</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  toolbarTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.space3, paddingTop: spacing.space3 },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    padding: spacing.space3,
    marginBottom: spacing.space4,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.space3 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  cardSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  syncBtn: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { fontSize: 15, fontWeight: "600", color: colors.primaryForeground },
  section: { marginBottom: spacing.space4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.space2,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
  },
  personMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  personMeta: { flex: 1, minWidth: 0 },
  personName: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  personHint: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  personActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  textAction: { paddingVertical: 8, paddingHorizontal: 4 },
  textActionLabel: { fontSize: 14, fontWeight: "600", color: colors.primary },
  iconAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  errorBox: { paddingVertical: 12 },
  errorText: { fontSize: 14, color: colors.destructive, marginBottom: 8 },
  retry: { fontSize: 14, fontWeight: "600", color: colors.primary },
  emptyHint: { fontSize: 14, color: colors.mutedForeground, lineHeight: 20 },
});
