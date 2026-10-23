import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { spring, useTheme } from "../src/lib/theme";
import { cloudEnabled } from "../src/lib/cloud";
import { init, nav, useApp } from "../src/state/app";
import { useSettings } from "../src/state/settings";
import { Logo } from "../src/ui/kit";
import { Toasts } from "../src/ui/Toasts";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** The logo settles in and the page rises underneath, instead of a hard cut from the splash. */
function Intro() {
  const t = useTheme();
  const s = useSharedValue(0.86);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withSpring(1, spring);
    o.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [s, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return (
    <Animated.View exiting={FadeOut.duration(420)} style={{ position: "absolute", inset: 0, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={a}>
        <Logo size={44} />
      </Animated.View>
    </Animated.View>
  );
}

export default function Root() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(true);
  const onboarded = useSettings((s) => s.onboarded);
  const signedIn = useApp((s) => !!s.session);
  const rise = useSharedValue(18);

  useEffect(() => {
    nav.openPro = (reason) => router.push({ pathname: "/pro", params: { reason } });
    nav.openNote = (id) => router.push(`/note/${id}`);
    void init().finally(() => {
      setReady(true);
      void SplashScreen.hideAsync();
      rise.value = withDelay(500, withSpring(0, spring));
      setTimeout(() => setIntro(false), 650);
    });
  }, [rise]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.bg);
  }, [t.bg]);

  // Tapping a due-date notification opens that class.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const id = response?.notification.request.content.data?.noteId;
    if (ready && typeof id === "string") router.push(`/note/${id}`);
  }, [response, ready]);

  useEffect(() => {
    if (ready && !onboarded) router.push("/welcome");
    // Every class belongs to an account on the phone, so the other devices see it.
    else if (ready && cloudEnabled && !signedIn) router.push("/signin");
  }, [ready, onboarded, signedIn]);

  const page = useAnimatedStyle(() => ({ flex: 1, transform: [{ translateY: rise.value }] }));

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <Animated.View style={page}>
          {ready && (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="note/[id]" options={{ headerShown: true, headerTransparent: true, headerTitle: "", headerBackButtonDisplayMode: "minimal", headerTintColor: t.fg }} />
              <Stack.Screen name="pro" options={{ presentation: "formSheet", sheetAllowedDetents: [0.88], sheetGrabberVisible: true, sheetCornerRadius: 32, contentStyle: { backgroundColor: t.bg } }} />
              <Stack.Screen name="welcome" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="signin" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
            </Stack>
          )}
        </Animated.View>
        {intro && <Intro />}
        <Toasts />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
