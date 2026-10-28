// The Pro sheet. One calm page, no countdowns, easy to close.
import { PRICING, PRO_PITCH } from "@notelater/core";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { PurchasesPackage } from "react-native-purchases";
import { fetchPlan, track } from "../src/lib/cloud";
import { buy, packages, purchasesEnabled, restore } from "../src/lib/purchases";
import { useTheme } from "../src/lib/theme";
import { app, useApp } from "../src/state/app";
import { Button, Press, T } from "../src/ui/kit";

const ICONS: Record<string, SFSymbol> = {
  calendarSync: "calendar.badge.plus",
  askNotes: "bubble.left.and.text.bubble.right",
  examPack: "books.vertical",
  instantUnlimitedSummaries: "bolt",
  export: "square.and.arrow.up",
};

export default function Pro() {
  const t = useTheme();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const session = useApp((s) => s.session);
  const plan = useApp((s) => s.plan);
  const [choice, setChoice] = useState<"yearly" | "monthly">("yearly");
  const [pkgs, setPkgs] = useState<{ monthly?: PurchasesPackage; yearly?: PurchasesPackage }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && purchasesEnabled) void packages(session.user.id).then(setPkgs).catch(() => {});
  }, [session]);

  // Lead with whatever brought them here.
  const pitch = [...PRO_PITCH].sort((a, b) => Number(b.feature === (reason === "calendar" ? "calendarSync" : reason === "ask" ? "askNotes" : "")) - Number(a.feature === (reason === "calendar" ? "calendarSync" : reason === "ask" ? "askNotes" : "")));

  const go = async () => {
    if (!session) {
      router.back();
      Alert.alert("Sign in first", "Pro belongs to your account, so it works on your laptop too. Sign in from Settings (free).");
      return;
    }
    const pkg = pkgs[choice];
    if (!pkg) return Alert.alert("Not available yet", "Subscriptions open with the next update.");
    setBusy(true);
    try {
      if (await buy(session.user.id, pkg)) {
        track("pro_purchased", { choice, reason });
        // Pro unlocks now; the server confirms through the RevenueCat webhook.
        app.set({ plan: "pro" });
        setTimeout(() => void fetchPlan().then((p) => p === "pro" && app.set({ plan: p })), 4000);
        router.back();
      }
    } catch (e) {
      if (!/cancel/i.test(String(e))) Alert.alert("Purchase didn't go through", String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (plan === "pro") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 10 }}>
        <T kind="title">You're Pro</T>
        <T kind="small" style={{ textAlign: "center" }}>Thanks for keeping NoteLater free for everyone else.</T>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 30, gap: 22 }}>
      <View style={{ gap: 6 }}>
        <T kind="eyebrow" style={{ color: t.clay }}>NoteLater Pro</T>
        <T kind="title">Never miss a due date again.</T>
        <T kind="small">Recording, transcripts, speaker labels and reminders stay free forever. Pro is for the extras.</T>
      </View>

      <View style={{ gap: 16 }}>
        {pitch.map((p, i) => (
          <Animated.View key={p.feature} entering={FadeInDown.springify().damping(18).delay(60 + i * 50)} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.bubble, alignItems: "center", justifyContent: "center" }}>
              <SymbolView name={ICONS[p.feature] ?? "sparkles"} tintColor={t.leather} size={19} />
            </View>
            <View style={{ flex: 1 }}>
              <T kind="h2">{p.title}</T>
              <T kind="small">{p.body}</T>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        {(["yearly", "monthly"] as const).map((k) => (
          <Press key={k} onPress={() => setChoice(k)} scaleTo={0.98}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: choice === k ? t.fg : t.line, backgroundColor: t.card }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: choice === k ? t.fg : t.line, alignItems: "center", justifyContent: "center" }}>
                {choice === k && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.fg }} />}
              </View>
              <T kind="body" style={{ flex: 1, fontWeight: "600" }}>{pkgs[k]?.product.priceString ? `${pkgs[k]!.product.priceString} / ${k === "yearly" ? "year" : "month"}` : PRICING[k].label}</T>
              {k === "yearly" && <T kind="mute" style={{ color: t.green }}>{PRICING.yearly.note}</T>}
            </View>
          </Press>
        ))}
      </View>

      <Button label={busy ? "One moment…" : "Continue"} onPress={() => void go()} disabled={busy} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
        <T kind="mute" onPress={() => router.back()}>Not now</T>
        {session && purchasesEnabled && (
          <T kind="mute" onPress={() => void restore(session.user.id).then((ok) => Alert.alert(ok ? "Restored" : "Nothing to restore"))}>
            Restore purchase
          </T>
        )}
      </View>
      <T kind="mute" style={{ textAlign: "center", fontSize: 11.5 }}>
        Renews automatically until cancelled in Settings › Apple ID › Subscriptions.
      </T>
    </ScrollView>
  );
}
