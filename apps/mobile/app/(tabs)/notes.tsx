// Every class, newest first, revealed a page at a time as you scroll.
import type { Note } from "@notelater/core";
import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/lib/theme";
import { useApp } from "../../src/state/app";
import { Glass, Hmu, Skeleton, T } from "../../src/ui/kit";
import { NoteRow } from "../../src/ui/NoteRow";

const PAGE = 20;

function matches(n: Note, q: string): boolean {
  const s = q.toLowerCase();
  return n.title.toLowerCase().includes(s) || (n.folder ?? "").toLowerCase().includes(s) || n.segments.some((x) => x.text.toLowerCase().includes(s));
}

export default function Notes() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const notes = useApp((s) => s.notes);
  const loaded = useApp((s) => s.loaded);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const list = useMemo(() => (q.trim() ? notes.filter((n) => matches(n, q.trim())) : notes), [notes, q]);
  const page = list.slice(0, shown);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140, paddingHorizontal: 20, gap: 10 }}
      data={loaded ? page : []}
      keyExtractor={(n) => n.id}
      onEndReachedThreshold={0.6}
      onEndReached={() => shown < list.length && setShown((s) => s + PAGE)}
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T kind="title">Notes</T>
            <Hmu />
          </View>
          <Glass radius={14} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
            <TextInput value={q} onChangeText={setQ} placeholder="Search every word ever said" placeholderTextColor={t.mute} style={{ fontSize: 16, color: t.fg }} clearButtonMode="while-editing" returnKeyType="search" />
          </Glass>
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.springify().damping(18).delay(Math.min(index % PAGE, 8) * 35)} layout={LinearTransition.springify()}>
          <NoteRow note={item} />
        </Animated.View>
      )}
      ListEmptyComponent={
        !loaded ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={92} />
            ))}
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 6 }}>
            <T kind="title" style={{ fontSize: 22 }}>{q ? "Nothing matches" : "No classes yet"}</T>
            <T kind="small" style={{ textAlign: "center" }}>{q ? "Try a word the teacher said." : "Record your first class from Home."}</T>
          </View>
        )
      }
      ListFooterComponent={shown < list.length ? <Skeleton height={92} style={{ marginTop: 10 }} /> : undefined}
    />
  );
}
