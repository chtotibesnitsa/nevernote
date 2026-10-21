// Your year in class: words, hours, streaks and a heat grid of recorded days.
import { insights } from "@nevernote/core";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/lib/theme";
import { useApp } from "../../src/state/app";
import { Card, Hmu, T } from "../../src/ui/kit";

const WEEKS = 18;

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Stat({ value, label, i }: { value: string; label: string; i: number }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18).delay(80 + i * 50)} style={{ width: "48%" }}>
      <Card style={{ gap: 2 }}>
        <T kind="title" style={{ fontSize: 30 }}>{value}</T>
        <T kind="mute">{label}</T>
      </Card>
    </Animated.View>
  );
}

function compact(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : n.toLocaleString();
}

export default function Insights() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const notes = useApp((s) => s.notes);
  const s = useMemo(() => insights(notes), [notes]);

  // Columns are weeks (oldest left), rows Monday..Sunday.
  const grid = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + w * 7 + d);
        return day > today ? -1 : (s.heatmap[dayKey(day)] ?? 0);
      }),
    );
  }, [s.heatmap]);

  // Sequential ramp, paper to leather: more minutes, darker cell.
  const ramp = (m: number) => (m < 0 ? "transparent" : m === 0 ? t.bubble : m < 20 ? "#dcc7b0" : m < 45 ? "#b8956f" : m < 90 ? "#8d6a4d" : t.leather);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140, paddingHorizontal: 20, gap: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T kind="title">Insights</T>
        <Hmu />
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T kind="title" style={{ fontSize: 26 }}>{s.streak} day streak</T>
            <T kind="mute">best {s.longestStreak}</T>
          </View>
          <View style={{ flexDirection: "row", gap: 3 }}>
            {grid.map((col, w) => (
              <View key={w} style={{ flex: 1, gap: 3 }}>
                {col.map((m, d) => (
                  <View key={d} style={{ aspectRatio: 1, borderRadius: 3, backgroundColor: ramp(m) }} />
                ))}
              </View>
            ))}
          </View>
          <T kind="mute">Weekends never break a streak.</T>
        </Card>
      </Animated.View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 }}>
        <Stat i={0} value={compact(s.totalWords)} label="words captured" />
        <Stat i={1} value={s.totalHours < 10 ? s.totalHours.toFixed(1) : String(Math.round(s.totalHours))} label="hours of class" />
        <Stat i={2} value={String(s.deadlinesCaught)} label="due dates caught" />
        <Stat i={3} value={String(s.wpm || "—")} label="words per minute" />
        <Stat i={4} value={String(s.notes)} label="classes" />
        <Stat i={5} value={String(s.speakersHeard)} label="voices told apart" />
      </View>

      {s.books > 0 && (
        <T kind="small" style={{ textAlign: "center", marginTop: 6 }}>
          That's about {s.books} {s.books === 1 ? "novel" : "novels"} worth of words you didn't have to write down.
        </T>
      )}
    </ScrollView>
  );
}
