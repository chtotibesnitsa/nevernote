import { PRICING } from "@nevernote/core";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import { Alert, Platform, ScrollView, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cloudEnabled, deleteAccount, sendEmailCode, signInWithApple, signInWithGoogle, supabase, verifyEmailCode } from "../../src/lib/cloud";
import { useTheme } from "../../src/lib/theme";
import { downloadModels, openPro, useApp } from "../../src/state/app";
import { settings, useSettings, type Settings as S } from "../../src/state/settings";
import { Button, Card, GITHUB_REPO, Hmu, Press, T } from "../../src/ui/kit";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <T kind="eyebrow">{title}</T>
      {hint && <T kind="mute" style={{ marginTop: 4 }}>{hint}</T>}
      <Card style={{ marginTop: 10, paddingVertical: 6 }}>{children}</Card>
    </View>
  );
}

function Toggle({ k, label, hint }: { k: keyof S; label: string; hint?: string }) {
  const t = useTheme();
  const on = useSettings((s) => !!s[k]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>
        <T kind="body">{label}</T>
        {hint && <T kind="mute">{hint}</T>}
      </View>
      <Switch value={on} onValueChange={(v) => settings.set({ [k]: v } as Partial<S>)} trackColor={{ true: t.green }} />
    </View>
  );
}

function SignIn() {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
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
    <View style={{ gap: 10, paddingVertical: 8 }}>
      <T kind="small">Use the same account on your laptop and phone. Free, and your notes sync both ways.</T>
      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={t.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999}
          style={{ height: 48 }}
          onPress={() => void run(signInWithApple)}
        />
      )}
      <Button variant="glass" label="Continue with Google" onPress={() => void run(signInWithGoogle)} disabled={busy} />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          value={sent ? code : email}
          onChangeText={sent ? setCode : setEmail}
          placeholder={sent ? "6-digit code" : "or your email"}
          placeholderTextColor={t.mute}
          keyboardType={sent ? "number-pad" : "email-address"}
          autoCapitalize="none"
          autoComplete={sent ? "one-time-code" : "email"}
          style={{ flex: 1, fontSize: 16, color: t.fg, borderWidth: 0.5, borderColor: t.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 }}
        />
        <Button
          variant="primary"
          label={sent ? "Verify" : "Send"}
          disabled={busy || (sent ? code.length < 6 : !email.includes("@"))}
          onPress={() => void run(async () => (sent ? verifyEmailCode(email, code) : sendEmailCode(email).then(() => setSent(true))))}
        />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const session = useApp((s) => s.session);
  const plan = useApp((s) => s.plan);
  const models = useApp((s) => s.models);
  const name = useSettings((s) => s.name);
  const theme = useSettings((s) => s.theme);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140, paddingHorizontal: 20 }} keyboardDismissMode="on-drag">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T kind="title">Settings</T>
        <Hmu />
      </View>

      <Section title="Account">
        {!cloudEnabled ? (
          <T kind="small" style={{ paddingVertical: 10 }}>This build runs fully on your phone. Sync and AI notes switch on when it's connected to a Nevernote server.</T>
        ) : session ? (
          <View style={{ gap: 10, paddingVertical: 8 }}>
            <View>
              <T kind="body" style={{ fontWeight: "500" }}>{session.user.email ?? "Signed in with Apple"}</T>
              <T kind="mute">{plan === "pro" ? "Pro" : "Free plan"} · syncing with every device you sign in on</T>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {plan !== "pro" && <Button label="Get Pro" onPress={() => openPro("settings")} />}
              <Button variant="ghost" label="Sign out" onPress={() => void supabase!.auth.signOut()} />
            </View>
            <T
              kind="mute"
              style={{ color: t.red }}
              onPress={() =>
                Alert.alert("Delete your account?", "Every synced note and your Pro status are erased from our server. Notes on this phone stay until you delete them.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete account", style: "destructive", onPress: () => void deleteAccount().catch((e) => Alert.alert("Couldn't delete", String(e?.message ?? e))) },
                ])
              }
            >
              Delete account
            </T>
          </View>
        ) : (
          <SignIn />
        )}
      </Section>

      <Section title="Your name">
        <TextInput
          value={name}
          onChangeText={(v) => settings.set({ name: v })}
          placeholder="What should Nevernote call you?"
          placeholderTextColor={t.mute}
          style={{ fontSize: 16, color: t.fg, paddingVertical: 10 }}
        />
      </Section>

      <Section title="Transcription" hint="Parakeet runs on this iPhone. Nothing you record is uploaded to transcribe it.">
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T kind="body">On-device models</T>
            <T kind="mute">
              {models.ready ? "Downloaded · works offline" : models.progress !== undefined ? `Downloading… ${Math.round(models.progress * 100)}%` : "About 530 MB, once. Wi-Fi recommended."}
            </T>
          </View>
          {!models.ready && models.progress === undefined && <Button variant="glass" label="Download" onPress={() => void downloadModels()} />}
        </View>
      </Section>

      <Section title="Notifications" hint="The moment Nevernote hears it, during class.">
        <Toggle k="notifyDeadlines" label="Due dates" hint="“Lab report due Friday at 11:59”" />
        <Toggle k="notifyExams" label="Tests and quizzes" hint="“Unit 3 test next Tuesday”" />
        <Toggle k="notifyImportant" label="“This will be on the test” moments" />
        <Toggle k="remindNightBefore" label="Remind me the evening before" hint="At 8 pm, plus an hour before when there's a time" />
        <Toggle k="proTips" label="Occasional Pro tips" hint="At most one every few days, never while you're recording" />
      </Section>

      <Section title="Data">
        <Toggle k="wifiOnly" label="Write notes on Wi-Fi only" hint="Recording and transcripts never need data. Only the summary does." />
        <Toggle k="haptics" label="Haptics" />
      </Section>

      <Section title="Appearance">
        <View style={{ flexDirection: "row", gap: 8, paddingVertical: 8 }}>
          {(["system", "light", "dark"] as const).map((v) => (
            <Press key={v} onPress={() => settings.set({ theme: v })} style={{ flex: 1 }}>
              <View style={{ alignItems: "center", paddingVertical: 10, borderRadius: 999, backgroundColor: theme === v ? t.fg : t.bubble }}>
                <T kind="small" style={{ color: theme === v ? t.bg : t.fg, fontWeight: "600" }}>{v[0].toUpperCase() + v.slice(1)}</T>
              </View>
            </Press>
          ))}
        </View>
      </Section>

      {plan !== "pro" && (
        <Press onPress={() => openPro("settings-card")} style={{ marginTop: 26 }}>
          <Card style={{ backgroundColor: t.dark ? "#241d17" : "#f1e6d8", borderColor: "transparent", gap: 4 }}>
            <T kind="h2">Nevernote Pro</T>
            <T kind="small">Due dates straight into your calendar, Ask your notes, instant summaries. {PRICING.yearly.label}.</T>
          </Card>
        </Press>
      )}

      <T kind="mute" style={{ textAlign: "center", marginTop: 30 }} onPress={() => void WebBrowser.openBrowserAsync(GITHUB_REPO)}>
        Nevernote is free and open source · source on GitHub
      </T>
    </ScrollView>
  );
}
