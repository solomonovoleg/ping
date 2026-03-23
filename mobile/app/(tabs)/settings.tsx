import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { router } from "expo-router";
import { UserAvatar } from "../../components/UserAvatar";
import { colors, spacing, radius } from "../../theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const name = [user?.displayName, user?.surname].filter(Boolean).join(" ") || "Пользователь";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={styles.profile}
        onPress={() => router.push("/profile/me")}
        activeOpacity={0.7}
      >
        <UserAvatar
          avatarUrl={user?.avatarUrl}
          displayName={name}
          seed={user?.id ?? "me"}
          size={80}
        />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.phone}>Номер не отображается — только для входа</Text>
        <Text style={styles.profileLink}>Профиль →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.space5, backgroundColor: colors.background },
  profile: { alignItems: "center", paddingVertical: spacing.space5 },
  profileLink: { fontSize: 14, color: colors.primary, marginTop: 8, fontWeight: "500" },
  name: { fontSize: 20, fontWeight: "600", marginTop: 12, color: colors.foreground },
  phone: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  logout: {
    marginTop: spacing.space6,
    padding: spacing.space4,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  logoutText: { fontSize: 16, color: colors.destructive, fontWeight: "500" },
});
