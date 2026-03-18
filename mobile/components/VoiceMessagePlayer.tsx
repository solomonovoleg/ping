import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { colors, radius } from "../theme";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  uri: string;
  isMe?: boolean;
};

export function VoiceMessagePlayer({ uri, isMe = true }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSound = async () => {
    setLoadError(false);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: uri.startsWith("http") ? uri : uri },
        { shouldPlay: false }
      );
      soundRef.current = sound;
      const status = await sound.getStatusAsync();
      if (status.isLoaded && typeof status.durationMillis === "number" && status.durationMillis > 0) {
        setDurationMs(status.durationMillis);
      }
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded) {
          setPositionMs(typeof s.positionMillis === "number" ? s.positionMillis : 0);
          if (typeof s.durationMillis === "number" && s.durationMillis > 0) setDurationMs(s.durationMillis);
          if (s.didJustFinishAndNotReset) setPlaying(false);
        }
      });
    } catch {
      setDurationMs(0);
      setLoadError(true);
    }
  };

  useEffect(() => {
    loadSound();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [uri]);

  const togglePlay = async () => {
    const sound = soundRef.current;
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
    } else {
      await sound.replayAsync();
      setPlaying(true);
    }
  };

  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  if (loadError) {
    return (
      <View style={[styles.wrap, isMe ? styles.wrapMe : styles.wrapOther]}>
        <Text style={[styles.time, isMe && styles.timeMe]}>Не удалось загрузить</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, isMe ? styles.wrapMe : styles.wrapOther]}>
      <TouchableOpacity
        onPress={togglePlay}
        style={[styles.playBtn, isMe ? styles.playBtnMe : styles.playBtnOther]}
      >
        <Text style={[styles.playIcon, isMe ? styles.playIconMe : styles.playIconOther]}>{playing ? "⏸" : "▶"}</Text>
      </TouchableOpacity>
      <View style={styles.progressWrap}>
        <Text style={[styles.time, isMe && styles.timeMe]}>{formatTime(positionMs / 1000)}</Text>
        <View style={[styles.track, isMe ? styles.trackMe : styles.trackOther]}>
          <View style={[styles.fill, isMe ? styles.fillMe : styles.fillOther, { width: `${progress}%` }]} />
        </View>
        <Text style={[styles.time, isMe && styles.timeMe]}>{durationMs > 0 ? formatTime(durationMs / 1000) : "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    gap: 12,
    minWidth: 200,
    maxWidth: 280,
  },
  wrapMe: { backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "flex-end" },
  wrapOther: { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  playBtnMe: { backgroundColor: "rgba(255,255,255,0.3)" },
  playBtnOther: { backgroundColor: colors.primary },
  playIcon: { fontSize: 14 },
  playIconMe: { color: "#fff" },
  playIconOther: { color: colors.primaryForeground },
  progressWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  time: { fontSize: 11, color: colors.foreground, width: 28 },
  timeMe: { color: "rgba(255,255,255,0.95)" },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  trackMe: { backgroundColor: "rgba(255,255,255,0.25)" },
  trackOther: { backgroundColor: "rgba(0,0,0,0.1)" },
  fill: { height: "100%", borderRadius: 3 },
  fillMe: { backgroundColor: "rgba(255,255,255,0.9)" },
  fillOther: { backgroundColor: colors.primary },
});
