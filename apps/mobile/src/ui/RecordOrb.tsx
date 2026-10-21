// The big record button: a breathing glass orb that melts into a stop square.
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { spring, useTheme } from "../lib/theme";
import { useApp } from "../state/app";
import { Glass, Press, T } from "./kit";

export function RecordOrb({ onPress, size = 168 }: { onPress: () => void; size?: number }) {
  const t = useTheme();
  const rec = useApp((s) => s.rec.state);
  const progress = useApp((s) => s.models.progress);
  const live = rec === "recording";
  const breathe = useSharedValue(0);
  const morph = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: live ? 1400 : 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [live, breathe]);
  useEffect(() => {
    morph.value = withSpring(rec === "idle" || rec === "starting" ? 0 : 1, spring);
  }, [rec, morph]);
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.25, live ? 0.6 : 0.4]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, live ? 1.16 : 1.07]) }],
  }));
  const core = useAnimatedStyle(() => {
    const d = interpolate(morph.value, [0, 1], [size * 0.42, size * 0.26]);
    return { width: d, height: d, borderRadius: interpolate(morph.value, [0, 1], [d / 2, 12]) };
  });
  const label = rec === "starting" ? (progress !== undefined ? `Getting ready… ${Math.round(progress * 100)}%` : "Starting…") : rec === "idle" ? "Tap to record" : rec === "paused" ? "Paused" : rec === "finishing" ? "Finishing…" : "Listening to the room";
  return (
    <View style={{ alignItems: "center", gap: 14 }}>
      <Press onPress={onPress} scaleTo={0.93} accessibilityRole="button" accessibilityLabel={rec === "idle" ? "Start recording" : "Open the recording"}>
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size, backgroundColor: live ? t.red : t.clay }, halo]} />
          <Glass radius={size} interactive style={{ width: size * 0.86, height: size * 0.86, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={[{ backgroundColor: live ? t.red : t.fg, alignItems: "center", justifyContent: "center" }, core]}>
              {rec === "idle" && <SymbolView name="mic.fill" tintColor={t.bg} size={size * 0.17} />}
            </Animated.View>
          </Glass>
        </View>
      </Press>
      <T kind="small" style={{ color: t.ink2 }}>{label}</T>
      {rec === "idle" && (
        <Text style={{ fontSize: 12.5, color: t.mute, textAlign: "center", maxWidth: 260 }}>Transcribed on this phone, even offline. Keeps going with the screen locked.</Text>
      )}
    </View>
  );
}
