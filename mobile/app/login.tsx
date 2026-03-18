import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { parseInputToDigits, normalizePhoneFromDigits, formatPhoneWithPrefix } from "../lib/phone";
import { colors, spacing, typography, radius } from "../theme";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const phoneNormalized = normalizePhoneFromDigits(phoneDigits);

  const handleLogin = async () => {
    const pass = password.trim();
    if (!phoneNormalized) {
      setError(phoneDigits.length === 0 ? "Введите номер телефона" : "Номер: 10 цифр, начинается с 9");
      return;
    }
    if (!pass) {
      setError("Введите пароль");
      return;
    }
    if (mode === "register" && pass.length < 6) {
      setError("Пароль не менее 6 символов");
      return;
    }
    if (mode === "register" && !referralCode.trim()) {
      setError("Введите пригласительный код");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(phoneNormalized, pass);
      } else {
        await register(phoneNormalized, pass, referralCode.trim());
      }
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Неверный номер или пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBlock}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="PING"
          />
          <Text style={styles.subtitle}>
            Персональный мессенджер! Максимальная приватность
          </Text>
        </View>

        {/* iOS-style segmented: как на вебе rounded-lg bg-secondary/80 p-1, кнопки rounded-md */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
            onPress={() => { setMode("login"); setError(""); }}
          >
            <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>
              Вход
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
            onPress={() => { setMode("register"); setError(""); }}
          >
            <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>
              Регистрация
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Телефон</Text>
          <TextInput
            style={styles.input}
            placeholder="+7 (9__) ___-__-__"
            placeholderTextColor={colors.mutedForeground}
            value={formatPhoneWithPrefix(phoneDigits)}
            onChangeText={(t) => { setPhoneDigits(parseInputToDigits(t)); setError(""); }}
            keyboardType="phone-pad"
            maxLength={18}
            editable={!loading}
          />

          {mode === "register" && (
            <>
              <Text style={[styles.label, { marginTop: spacing.space4 }]}>Пригласительный код</Text>
              <TextInput
                style={styles.input}
                placeholder="например: дом моды"
                placeholderTextColor={colors.mutedForeground}
                value={referralCode}
                onChangeText={(t) => { setReferralCode(t); setError(""); }}
                editable={!loading}
              />
            </>
          )}

          <Text style={[styles.label, { marginTop: spacing.space4 }]}>Пароль</Text>
          <TextInput
            style={styles.input}
            placeholder={mode === "register" ? "Не менее 6 символов" : "Пароль"}
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(""); }}
            secureTextEntry
            editable={!loading}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || !phoneNormalized || (mode === "register" && !referralCode.trim())}
          >
            <Text style={styles.submitText}>
              {loading ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.space4,
    paddingTop: 48,
    paddingBottom: 48,
  },
  logoBlock: { alignItems: "center", marginBottom: spacing.space5 },
  logoImage: { height: 112, width: "100%", maxWidth: 200 },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.mutedForeground,
    marginTop: spacing.space2,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    maxWidth: 260,
  },
  segment: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.space5,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 15, fontWeight: "600", color: colors.mutedForeground },
  segmentTextActive: { color: colors.foreground },
  form: { width: "100%", maxWidth: 340 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
    marginBottom: spacing.space2,
  },
  input: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: typography.input,
    color: colors.foreground,
    marginBottom: spacing.space4,
  },
  errorText: { fontSize: 14, color: colors.destructive, marginTop: spacing.space2, marginBottom: spacing.space2 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: spacing.touchMin,
    marginTop: spacing.space4,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: typography.input, fontWeight: "600", color: colors.primaryForeground },
});
