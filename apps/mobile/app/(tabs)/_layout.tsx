// Native iOS tabs: on iOS 26 the bar is real liquid glass and shrinks as you
// scroll. While recording, a mini player rides above it on every tab.
import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../src/lib/theme";
import { pause, resume, stop, useApp } from "../../src/state/app";
import { fmtClock, Wave } from "../../src/ui/kit";

function LiveAccessory() {
  const t = useTheme();
  const rec = useApp((s) => s.rec);
  const title = useApp((s) => s.notes.find((n) => n.id === s.rec.noteId)?.title);
  const inline = NativeTabs.BottomAccessory.usePlacement() === "inline";
  const paused = rec.state === "paused";
  return (
    <Pressable onPress={() => rec.noteId && router.push(`/note/${rec.noteId}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 }}>
      <Wave active={!paused} bars={inline ? 5 : 7} height={16} color={paused ? t.orange : t.red} />
      {!inline && <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: t.fg }}>{title ?? "Recording"}</Text>}
      <Text style={{ fontVariant: ["tabular-nums"], fontSize: 14, color: paused ? t.orange : t.ink2 }}>{paused ? "Paused" : fmtClock(rec.elapsed)}</Text>
      <View style={{ flexDirection: "row", gap: 14, marginLeft: inline ? 0 : 6 }}>
        <Pressable hitSlop={10} onPress={paused ? resume : pause} accessibilityLabel={paused ? "Resume" : "Pause"}>
          <SymbolView name={paused ? "play.fill" : "pause.fill"} tintColor={t.fg} size={18} />
        </Pressable>
        <Pressable hitSlop={10} onPress={() => void stop()} accessibilityLabel="Stop">
          <SymbolView name="stop.fill" tintColor={t.red} size={18} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function Tabs() {
  const t = useTheme();
  const recording = useApp((s) => s.rec.state === "recording" || s.rec.state === "paused");
  const due = useApp((s) => s.notes.reduce((a, n) => a + n.extractions.filter((e) => (e.kind === "deadline" || e.kind === "exam") && e.when && Date.parse(e.when) > Date.now()).length, 0));
  return (
    <NativeTabs tintColor={t.leather} minimizeBehavior="onScrollDown" labelStyle={{ color: t.mute }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        {due > 0 && <NativeTabs.Trigger.Badge>{String(due)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Icon sf={{ default: "book.closed", selected: "book.closed.fill" }} />
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights">
        <NativeTabs.Trigger.Icon sf="chart.bar.xaxis" />
        <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {recording && (
        <NativeTabs.BottomAccessory>
          <LiveAccessory />
        </NativeTabs.BottomAccessory>
      )}
    </NativeTabs>
  );
}
