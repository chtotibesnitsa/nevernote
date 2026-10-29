// First run: what it does, the two permissions, and the one-time model
// download, which keeps going while you read.
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOutUp, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spring, useTheme } from "../src/lib/theme";
import { downloadModels, useApp } from "../src/state/app";
import { settings, useSettings } from "../src/state/settings";
import { Button, Logo, T } from "../src/ui/kit";

const PAGES: { icon: SFSymbol; title: string; body: string }[] = [
  { icon: "waveform", title: "Every word in the room.", body: "Put your phone on the desk. NoteLater writes down the teacher, the questions and the answers, and tells the voices apart." },
  { icon: "lock.shield", title: "Stays on your phone.", body: "Transcription runs on this iPhone, even in airplane mode. Nothing is uploaded to turn speech into text." },
  { icon: "calendar.badge.clock", title: "Due dates find you.", body: "“Lab report due Friday at 11:59” becomes a notification the moment it's said, and a reminder the night before." },
];

function Progress({ p }: { p: number }) {
  const t = useTheme();
  const a = useAnimatedStyle(() => ({ width: withSpring(`${Math.max(4, p * 100)}%`, spring) }));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.bubble, overflow: "hidden" }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: t.leather }, a]} />
    </View>
  );
}

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const models = useApp((s) => s.models);
  const name = useSettings((s) => s.name);

  // Start the download right away; by the last page it's usually well along.
  useEffect(() => {
    if (!models.ready && models.progress === undefined) void downloadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = page === PAGES.length;
  const next = async () => {
    if (page === 2) await Notifications.requestPermissionsAsync().catch(() => null);
    if (!last) return setPage(page + 1);
    settings.set({ onboarded: true });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20, paddingHorizontal: 28 }}>
      <Animated.View entering={FadeIn.duration(500)}>
        <Logo size={26} />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: "center" }}>
        {!last ? (
          <Animated.View key={page} entering={FadeInDown.springify().damping(18)} exiting={FadeOutUp.duration(180)} style={{ gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.bubble, alignItems: "center", justifyContent: "center" }}>
              <SymbolView name={PAGES[page].icon} tintColor={t.leather} size={30} />
            </View>
            <T kind="display">{PAGES[page].title}</T>
            <T kind="body" style={{ color: t.ink2, fontSize: 18, lineHeight: 26 }}>{PAGES[page].body}</T>
          </Animated.View>
        ) : (
          <Animated.View key="name" entering={FadeInDown.springify().damping(18)} style={{ gap: 16 }}>
            <T kind="display">What should we call you?</T>
            <TextInput
              value={name}
              onChangeText={(v) => settings.set({ name: v })}
              placeholder="Your first name"
              placeholderTextColor={t.mute}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void next()}
              style={{ fontSize: 24, color: t.fg, borderBottomWidth: 1, borderColor: t.line, paddingVertical: 10 }}
            />
          </Animated.View>
        )}
      </View>

      <View style={{ gap: 14 }}>
        {!models.ready && (
          <View style={{ gap: 6 }}>
            <Progress p={models.progress ?? 0} />
            <T kind="mute">{models.error ? "Download paused · it resumes on its own" : `Getting the on-device models ready · ${Math.round((models.progress ?? 0) * 100)}%`}</T>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
          {[...PAGES, null].map((_, i) => (
            <View key={i} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? t.fg : t.line }} />
          ))}
        </View>
        <Button label={last ? "Start" : page === 2 ? "Allow notifications" : "Next"} onPress={() => void next()} />
      </View>
    </View>
  );
}
