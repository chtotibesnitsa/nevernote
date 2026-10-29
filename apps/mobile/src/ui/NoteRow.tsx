import type { Note } from "@notelater/core";
import { router } from "expo-router";
import { View } from "react-native";
import { useTheme } from "../lib/theme";
import { Press, StageDots, T } from "./kit";

function ago(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: "long" })} · ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function NoteRow({ note }: { note: Note }) {
  const t = useTheme();
  const due = note.extractions.filter((e) => e.kind === "deadline" || e.kind === "exam").length;
  const preview = note.summary?.notes.replace(/[#*_>-]/g, "").trim().split("\n").find(Boolean) ?? note.segments.slice(0, 3).map((s) => s.text).join(" ");
  return (
    <Press onPress={() => router.push(`/note/${note.id}`)} scaleTo={0.98}>
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: t.card, borderWidth: 0.5, borderColor: t.line, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <T kind="h2" numberOfLines={1} style={{ flex: 1 }}>{note.title}</T>
          <StageDots stage={note.stage} />
        </View>
        {preview ? <T kind="small" numberOfLines={2}>{preview}</T> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <T kind="mute">{ago(note.createdAt)}</T>
          {note.durationSec > 0 && <T kind="mute">· {Math.max(1, Math.round(note.durationSec / 60))} min</T>}
          {due > 0 && <T kind="mute" style={{ color: t.clay }}>· {due} due</T>}
          {note.speakers.length > 1 && <T kind="mute">· {note.speakers.length} voices</T>}
        </View>
      </View>
    </Press>
  );
}
