// Phones and laptops always sign in, so every class lands in the account and
// shows up on the website and the desktop app. Guest mode is web only.
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signInWithApple, signInWithGoogle } from "../src/lib/cloud";
import { useTheme } from "../src/lib/theme";
import { useApp } from "../src/state/app";
import { Button, Logo, T } from "../src/ui/kit";

export default function SignInScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const session = useApp((s) => s.session);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && router.canGoBack()) router.back();
  }, [session]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      if (!/cancel/i.test(m)) Alert.alert("Couldn't sign in", m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24, paddingHorizontal: 28 }}>
      <Logo size={26} />
      <Animated.View entering={FadeInDown.springify().damping(18)} style={{ flex: 1, justifyContent: "center", gap: 14 }}>
        <T kind="display">Save every class.</T>
        <T kind="body" style={{ color: t.ink2, fontSize: 18, lineHeight: 26 }}>
          Sign in once and your recordings, notes and due dates follow you to your laptop and the web. Free forever.
        </T>
      </Animated.View>
      <View style={{ gap: 10 }}>
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={t.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ height: 50 }}
            onPress={() => void run(signInWithApple)}
          />
        )}
        <Button variant="glass" label="Continue with Google" onPress={() => void run(signInWithGoogle)} disabled={busy} />
        <T kind="mute" style={{ textAlign: "center" }}>Audio never leaves your phone. Only the transcript text syncs.</T>
      </View>
    </View>
  );
}
