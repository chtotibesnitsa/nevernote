import type { Extraction, Note } from "@notelater/core";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/lib/theme";
import { start, useApp } from "../../src/state/app";
import { useSettings } from "../../src/state/settings";
import { Card, fmtWhen, Hmu, Logo, Press, T } from "../../src/ui/kit";
import { NoteRow } from "../../src/ui/NoteRow";
import { RecordOrb } from "../../src/ui/RecordOrb";

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export function upcoming(notes: Note[]): { e: Extraction; note: Note }[] {
  const now = Date.now();
  return notes
    .flatMap((note) => note.extractions.filter((e) => (e.kind === "deadline" || e.kind === "exam") && e.when && Date.parse(e.when) > now - 3600_000).map((e) => ({ e, note })))
    .sort((a, b) => Date.parse(a.e.when!) - Date.parse(b.e.when!));
}

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const name = useSettings((s) => s.name);
  const notes = useApp((s) => s.notes);
  const rec = useApp((s) => s.rec);
  const due = useMemo(() => upcoming(notes).slice(0, 4), [notes]);
  const recent = notes.slice(0, 3);

  const onOrb = async () => {
    if (rec.state === "idle") {
      const id = await start();
      if (id) router.push(`/note/${id}`);
    } else if (rec.noteId) router.push(`/note/${rec.noteId}`);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140, paddingHorizontal: 20 }} contentInsetAdjustmentBehavior="never">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Logo size={24} />
        <Hmu />
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18).delay(80)} style={{ marginTop: 28 }}>
        <T kind="display">{greeting(name)}</T>
        <T kind="small" style={{ marginTop: 6 }}>Put your phone on the desk. NoteLater catches every word, who said it, and every due date.</T>
      </Animated.View>

      <Animated.View entering={FadeInDown.springify().damping(18).delay(160)} style={{ marginVertical: 34 }}>
        <RecordOrb onPress={() => void onOrb()} />
      </Animated.View>

      {due.length > 0 && (
        <Animated.View entering={FadeInDown.springify().damping(18).delay(240)}>
          <T kind="eyebrow" style={{ marginBottom: 10 }}>Coming up</T>
          <Card style={{ paddingVertical: 4 }}>
            {due.map(({ e, note }, i) => (
              <Press key={e.id} onPress={() => router.push(`/note/${note.id}`)} scaleTo={0.98}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i ? 0.5 : 0, borderColor: t.line }}>
                  <SymbolView name={e.kind === "exam" ? "graduationcap.fill" : "calendar.badge.clock"} tintColor={e.kind === "exam" ? t.leather : t.clay} size={20} />
                  <View style={{ flex: 1 }}>
                    <T kind="body" numberOfLines={1} style={{ fontWeight: "500" }}>{e.title}</T>
                    <T kind="mute" numberOfLines={1}>{fmtWhen(e.when!, e.allDay)} · {note.title}</T>
                  </View>
                </View>
              </Press>
            ))}
          </Card>
        </Animated.View>
      )}

      {recent.length > 0 && (
        <Animated.View entering={FadeInDown.springify().damping(18).delay(320)} style={{ marginTop: 28, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T kind="eyebrow">Recent</T>
            <Press onPress={() => router.push("/notes")}>
              <T kind="mute" style={{ color: t.leather }}>See all</T>
            </Press>
          </View>
          {recent.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}
