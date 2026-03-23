import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

type Props = {
  note?: string | null;
};

/** Замена строки ввода в DM, если собеседник ограничил переписку. */
export function DmBlockedComposer({ note }: Props) {
  const trimmed = typeof note === "string" ? note.trim() : "";
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Вы заблокированы в переписке</Text>
      <Text style={styles.sub}>Собеседник ограничил для вас сообщения и звонки в приложении.</Text>
      {trimmed ? <Text style={styles.note}>&ldquo;{trimmed}&rdquo;</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.space4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.secondary,
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.foreground, textAlign: "center" },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    color: colors.foreground,
    textAlign: "center",
    padding: spacing.space3,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
});
