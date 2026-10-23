// One class: live transcript while recording, then notes, due dates, study
// guide and key terms. Recording controls float at the bottom.
import { stageInfo, type Extraction, type Note, type Segment } from "@nevernote/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, interpolate, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addAll, addOne } from "../../src/lib/calendar";
import { ask, cloudEnabled } from "../../src/lib/cloud";
import { serif, speakerTint, spring, useTheme } from "../../src/lib/theme";
import { nudge, openPro, pause, removeNote, renameSpeaker, resume, stop, summarize, toast, update, useApp } from "../../src/state/app";
import { Button, Card, fmtClock, fmtWhen, Glass, Press, Skeleton, StageDots, StatusDot, T, Wave } from "../../src/ui/kit";

type Tab = "summary" | "transcript" | "thoughts";

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const note = useApp((s) => s.notes.find((n) => n.id === id));
  const live = useApp((s) => s.rec.noteId === id && s.rec.state !== "idle");
  const [tab, setTab] = useState<Tab>(live ? "transcript" : "summary");
  useEffect(() => {
    if (live) setTab("transcript");
  }, [live]);

  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, paddingTop: 120, gap: 12 }}>
        <Skeleton height={40} />
        <Skeleton height={18} style={{ width: "60%" }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              hitSlop={10}
              onPress={() =>
                Alert.alert("Delete this class?", "The transcript and notes go too. This can't be undone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => void removeNote(note.id).then(() => router.back()) },
                ])
              }
            >
              <SymbolView name="trash" tintColor={t.mute} size={18} />
            </Pressable>
          ),
        }}
      />
      {tab === "transcript" ? (
        <Transcript note={note} live={live} header={<Header note={note} tab={tab} setTab={setTab} />} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 104, paddingBottom: 180 }} keyboardDismissMode="on-drag">
          <Header note={note} tab={tab} setTab={setTab} />
          {tab === "summary" ? <SummaryTab note={note} /> : <Thoughts note={note} />}
        </ScrollView>
      )}
      <BottomBar note={note} live={live} />
    </KeyboardAvoidingView>
  );
}

// ---------------- header ----------------

function Header({ note, tab, setTab }: { note: Note; tab: Tab; setTab: (t: Tab) => void }) {
  const t = useTheme();
  const [title, setTitle] = useState(note.title);
  useEffect(() => setTitle(note.title), [note.title]);
  const d = new Date(note.createdAt);
  return (
    <View style={{ gap: 10, marginBottom: 18 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onEndEditing={() => title.trim() && title !== note.title && update(note.id, { title: title.trim() })}
        multiline
        style={{ fontFamily: serif, fontSize: 32, lineHeight: 37, color: t.fg, padding: 0 }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <T kind="mute">
          {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {note.durationSec > 0 ? ` · ${fmtClock(note.durationSec)}` : ""}
        </T>
        <StageDots stage={note.stage} withLabel />
      </View>
      <Speakers note={note} />
      <Segmented value={tab} onChange={setTab} />
    </View>
  );
}

function Segmented({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const t = useTheme();
  const tabs: { k: Tab; label: string }[] = [
    { k: "summary", label: "Notes" },
    { k: "transcript", label: "Transcript" },
    { k: "thoughts", label: "My thoughts" },
  ];
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const i = tabs.findIndex((x) => x.k === value);
  useEffect(() => {
    x.value = withSpring(i, spring);
  }, [i, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (w / tabs.length) }] }));
  return (
    <Glass radius={999} style={{ marginTop: 6 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width - 8)} style={{ flexDirection: "row", padding: 4 }}>
        {w > 0 && <Animated.View style={[{ position: "absolute", top: 4, left: 4, bottom: 4, width: w / tabs.length, borderRadius: 999, backgroundColor: t.card }, pill]} />}
        {tabs.map((x) => (
          <Pressable key={x.k} onPress={() => onChange(x.k)} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ fontSize: 14.5, fontWeight: value === x.k ? "600" : "400", color: value === x.k ? t.fg : t.ink2 }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
    </Glass>
  );
}

function Speakers({ note }: { note: Note }) {
  const t = useTheme();
  if (note.speakers.length < 2) return null;
  const rename = (id: string, cur: string) =>
    Alert.prompt("Who is this?", "Name this voice everywhere in the class.", (v) => v?.trim() && renameSpeaker(note.id, id, v.trim()), "plain-text", cur);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {note.speakers.map((s) => (
        <Pressable key={s.id} onPress={() => rename(s.id, s.name)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: t.bubble }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: speakerTint(s.id) }} />
          <Text style={{ fontSize: 13, color: t.ink2 }}>
            {s.name} · {Math.round(s.share * 100)}%
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------------- transcript ----------------

function Transcript({ note, live, header }: { note: Note; live: boolean; header: React.ReactElement }) {
  const t = useTheme();
  const list = useRef<FlatList<Segment>>(null);
  const [follow, setFollow] = useState(true);
  const names = useMemo(() => new Map(note.speakers.map((s) => [s.id, s.name])), [note.speakers]);
  const flags = useMemo(() => new Map(note.extractions.filter((e) => e.segmentId).map((e) => [e.segmentId!, e])), [note.extractions]);
  useEffect(() => {
    if (live && follow && note.segments.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  }, [note.segments.length, live, follow]);
  return (
    <FlatList
      ref={list}
      data={note.segments}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 104, paddingBottom: 200, gap: 8 }}
      ListHeaderComponent={header}
      onScrollBeginDrag={() => setFollow(false)}
      onMomentumScrollEnd={(e) => {
        const n = e.nativeEvent;
        setFollow(n.contentOffset.y + n.layoutMeasurement.height > n.contentSize.height - 120);
      }}
      renderItem={({ item, index }) => {
        const prev = note.segments[index - 1];
        const showWho = item.speaker && item.speaker !== prev?.speaker;
        const flag = flags.get(item.id);
        return (
          <Animated.View entering={live ? FadeInDown.springify().damping(20) : undefined} layout={LinearTransition.springify()} style={{ gap: 4, marginTop: showWho ? 8 : 0 }}>
            {showWho && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: speakerTint(item.speaker) }} />
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: t.ink2 }}>{names.get(item.speaker!) ?? item.speaker}</Text>
                <Text style={{ fontSize: 12, color: t.mute, fontVariant: ["tabular-nums"] }}>{fmtClock(item.start)}</Text>
              </View>
            )}
            <View style={{ alignSelf: "flex-start", maxWidth: "100%", backgroundColor: flag ? (t.dark ? "#2d2219" : "#f4e6d6") : t.bubble, borderRadius: 18, borderTopLeftRadius: showWho ? 6 : 18, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text selectable style={{ fontSize: 16, lineHeight: 23, color: t.fg }}>{item.text}</Text>
              {flag && (
                <Text style={{ marginTop: 4, fontSize: 12, fontWeight: "600", color: t.clay }}>
                  {flag.kind === "important" ? "★ Worth remembering" : `${flag.kind === "exam" ? "Test" : "Due"}${flag.when ? ` · ${fmtWhen(flag.when, flag.allDay)}` : ""}`}
                </Text>
              )}
            </View>
          </Animated.View>
        );
      }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 30, gap: 10 }}>
          {live ? (
            <>
              <Wave active />
              <T kind="small">Listening. Words appear a second after each pause.</T>
            </>
          ) : (
            <T kind="small">No words in this one.</T>
          )}
        </View>
      }
    />
  );
}

// ---------------- notes / summary ----------------

function SummaryTab({ note }: { note: Note }) {
  const t = useTheme();
  const session = useApp((s) => s.session);
  const online = useApp((s) => s.online);
  const plan = useApp((s) => s.plan);
  const [sponsor, setSponsor] = useState(false);
  const s = note.summary;
  const due = note.extractions.filter((e) => e.kind !== "important");
  const important = note.extractions.filter((e) => e.kind === "important");

  if (!s) {
    const info = stageInfo(note.stage);
    return (
      <View style={{ gap: 26 }}>
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24, borderStyle: "dashed" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusDot dot={info.dot} live={info.live} />
            <T kind="h2">{info.label}</T>
          </View>
          {note.stage === "summarising" ? (
            <View style={{ alignSelf: "stretch", gap: 10, marginTop: 8 }}>
              {[90, 75, 82, 60].map((w, i) => (
                <Skeleton key={i} height={13} style={{ width: `${w}%` }} />
              ))}
            </View>
          ) : (
            <T kind="small" style={{ textAlign: "center" }}>
              {!cloudEnabled
                ? "AI notes need the Nevernote server. The transcript and due dates are already here."
                : !session
                  ? "Sign in (free, in Settings) and Nevernote writes notes, a study guide and key terms for every class."
                  : !online
                    ? "You're offline. This class is saved, and its notes get written the moment you're back online."
                    : note.stage === "queued"
                      ? "Queued for tonight: today's 10 instant classes are used. Get them now below."
                      : "Ready when you are."}
            </T>
          )}
          {cloudEnabled && session && online && note.segments.length > 0 && note.stage !== "summarising" && (
            <View style={{ gap: 8, marginTop: 6, alignItems: "center" }}>
              <Button label="Write my notes" onPress={() => void summarize(note.id)} />
              {note.stage === "queued" && plan === "free" && <Button variant="ghost" label="Get them now · 5-second sponsor" onPress={() => setSponsor(true)} />}
            </View>
          )}
        </Card>
        {sponsor && <SponsorCard onDone={() => (setSponsor(false), void summarize(note.id, true))} onClose={() => setSponsor(false)} />}
        <DueList items={due} note={note} />
        {important.length > 0 && <Important items={important} />}
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ gap: 30 }}>
      <DueList items={due} note={note} />
      <Markdown text={s.notes} />
      {important.length > 0 && <Important items={important} />}
      {s.studyGuide.length > 0 && <StudyGuide qa={s.studyGuide} />}
      {s.keyTerms.length > 0 && (
        <View style={{ gap: 10 }}>
          <T kind="eyebrow">Key terms</T>
          {s.keyTerms.map((k) => (
            <View key={k.term} style={{ backgroundColor: t.bubble, borderRadius: 18, padding: 14, gap: 3 }}>
              <Text style={{ fontFamily: serif, fontSize: 18, color: t.fg }}>{k.term}</Text>
              <T kind="small">{k.definition}</T>
            </View>
          ))}
        </View>
      )}
      <T kind="mute">Written by {s.model.split("/").pop()} · check anything important against the transcript.</T>
    </Animated.View>
  );
}

/** Just enough Markdown for the notes: headings, bullets and **bold**. */
function Markdown({ text }: { text: string }) {
  const t = useTheme();
  const inline = (s: string, key: number) => (
    <Text key={key}>
      {s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <Text key={i} style={{ fontWeight: "700" }}>{p.slice(2, -2)}</Text> : p))}
    </Text>
  );
  return (
    <View style={{ gap: 8 }}>
      {text.split("\n").map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const h = line.match(/^(#{1,4})\s+(.*)/);
        if (h) return <Text key={i} style={{ fontFamily: serif, fontSize: h[1].length <= 2 ? 23 : 19, color: t.fg, marginTop: i ? 12 : 0 }}>{h[2]}</Text>;
        const b = line.match(/^(\s*)[-*•]\s+(.*)/);
        if (b)
          return (
            <View key={i} style={{ flexDirection: "row", gap: 10, paddingLeft: b[1].length ? 18 : 0 }}>
              <Text style={{ color: t.clay, fontSize: 16, lineHeight: 24 }}>•</Text>
              <Text style={{ flex: 1, fontSize: 16, lineHeight: 24, color: t.fg }}>{inline(b[2], 0)}</Text>
            </View>
          );
        return <Text key={i} style={{ fontSize: 16, lineHeight: 24, color: t.fg }}>{inline(line, 0)}</Text>;
      })}
    </View>
  );
}

function DueList({ items, note }: { items: Extraction[]; note: Note }) {
  const t = useTheme();
  const plan = useApp((s) => s.plan);
  if (!items.length) return null;
  const dated = items.filter((e) => e.when);
  const addEverything = async () => {
    if (plan !== "pro") return openPro("calendar");
    const n = await addAll(dated, note);
    toast({ title: n ? `Added ${n} to your calendar` : "Calendar access is off", body: n ? "With an alert the day before." : "Turn it on in Settings › Nevernote." });
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T kind="eyebrow">Due dates & tests</T>
        {dated.length > 0 && (
          <Press onPress={() => void addEverything()}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <SymbolView name="calendar.badge.plus" tintColor={t.leather} size={15} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: t.leather }}>{dated.length > 1 ? `All ${dated.length} to calendar` : "To calendar"}</Text>
              {plan !== "pro" && <Text style={{ fontSize: 10, fontWeight: "700", color: t.clay }}>PRO</Text>}
            </View>
          </Press>
        )}
      </View>
      <Card style={{ paddingVertical: 2 }}>
        {items.map((e, i) => (
          <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: i ? 0.5 : 0, borderColor: t.line }}>
            <View style={{ width: 46, alignItems: "center" }}>
              {e.when ? (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: t.red, textTransform: "uppercase" }}>{new Date(e.when).toLocaleDateString(undefined, { month: "short" })}</Text>
                  <Text style={{ fontFamily: serif, fontSize: 26, lineHeight: 28, color: t.fg }}>{new Date(e.when).getDate()}</Text>
                </>
              ) : (
                <Text style={{ fontSize: 11, color: t.mute }}>no date</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T kind="body" style={{ fontWeight: "500" }}>{e.title}</T>
              <T kind="mute" numberOfLines={2}>
                {e.when && !e.allDay ? `${new Date(e.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ` : ""}“{e.phrase}”
              </T>
            </View>
            {e.when && (
              <Pressable hitSlop={8} onPress={() => void addOne(e, note).then((ok) => ok && setTimeout(() => nudge("deadlineFound"), 800))} accessibilityLabel="Add to calendar">
                <SymbolView name="calendar.badge.plus" tintColor={t.ink2} size={20} />
              </Pressable>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}

function Important({ items }: { items: Extraction[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <T kind="eyebrow">They said this matters</T>
      {items.map((e) => (
        <View key={e.id} style={{ borderLeftWidth: 3, borderColor: t.clay, backgroundColor: t.bubble, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontFamily: serif, fontStyle: "italic", fontSize: 17, lineHeight: 24, color: t.fg }}>“{e.phrase}”</Text>
        </View>
      ))}
    </View>
  );
}

function FlipCard({ q, a }: { q: string; a: string }) {
  const t = useTheme();
  const r = useSharedValue(0);
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(r.value, [0, 1], [0, 180])}deg` }], backfaceVisibility: "hidden" }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${interpolate(r.value, [0, 1], [180, 360])}deg` }], backfaceVisibility: "hidden" }));
  return (
    <Pressable onPress={() => (r.value = withTiming(r.value > 0.5 ? 0 : 1, { duration: 520 }))} style={{ minHeight: 120 }}>
      <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: t.card, borderRadius: 20, borderWidth: 0.5, borderColor: t.line, padding: 16, justifyContent: "center" }, front]}>
        <Text style={{ fontFamily: serif, fontSize: 18, lineHeight: 24, color: t.fg }}>{q}</Text>
      </Animated.View>
      <Animated.View style={[{ minHeight: 120, backgroundColor: t.fg, borderRadius: 20, padding: 16, justifyContent: "center" }, back]}>
        <Text style={{ fontSize: 15, lineHeight: 21, color: t.bg }}>{a}</Text>
      </Animated.View>
    </Pressable>
  );
}

function StudyGuide({ qa }: { qa: { question: string; answer: string }[] }) {
  return (
    <View style={{ gap: 10 }}>
      <T kind="eyebrow">Study guide · tap to flip</T>
      {qa.map((x, i) => (
        <FlipCard key={i} q={x.question} a={x.answer} />
      ))}
    </View>
  );
}

/** House "sponsor" card: a 5-second pause in exchange for instant free notes. Swap in an ad network later. */
function SponsorCard({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const t = useTheme();
  const [left, setLeft] = useState(5);
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = withTiming(1, { duration: 5000 });
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [bar]);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  const a = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  return (
    <Animated.View entering={FadeInDown.springify()} style={{ backgroundColor: t.fg, borderRadius: 24, padding: 20, overflow: "hidden", gap: 6 }}>
      <Pressable onPress={onClose} hitSlop={10} style={{ position: "absolute", right: 16, top: 16 }}>
        <SymbolView name="xmark" tintColor={t.bg} size={13} />
      </Pressable>
      <Text style={{ fontSize: 11, letterSpacing: 1.2, color: t.bg, opacity: 0.6 }}>SPONSORED · {Math.max(0, left)}s</Text>
      <Text style={{ fontFamily: serif, fontSize: 22, color: t.bg }}>Nevernote is free because of people like you.</Text>
      <Text style={{ fontSize: 14, color: t.bg, opacity: 0.8 }}>Star it on GitHub, tell a friend in your class, or go Pro to skip this forever.</Text>
      <Animated.View style={[{ position: "absolute", left: 0, bottom: 0, height: 3, backgroundColor: t.clay }, a]} />
    </Animated.View>
  );
}

// ---------------- my thoughts ----------------

function Thoughts({ note }: { note: Note }) {
  const t = useTheme();
  const [text, setText] = useState(note.thoughts);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <TextInput
      value={text}
      onChangeText={(v) => {
        setText(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => update(note.id, { thoughts: v }), 500);
      }}
      multiline
      placeholder="Your own notes. They go into the AI summary too."
      placeholderTextColor={t.mute}
      style={{ minHeight: 300, fontSize: 17, lineHeight: 25, color: t.fg, textAlignVertical: "top" }}
    />
  );
}

// ---------------- bottom bar ----------------

function BottomBar({ note, live }: { note: Note; live: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const rec = useApp((s) => s.rec);
  const plan = useApp((s) => s.plan);
  const session = useApp((s) => s.session);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const submit = async (question: string) => {
    if (!question.trim()) return;
    if (plan !== "pro" || !session) {
      nudge("askedQuestion");
      openPro("ask");
      return;
    }
    setAsking(true);
    const r = await ask(question, [note.id]);
    setAsking(false);
    setQ("");
    setAnswer(r.answer ?? (r.error === "pro" ? null : `Couldn't answer: ${r.error}`));
  };

  return (
    <View style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 8, gap: 8 }}>
      {answer && (
        <Animated.View entering={FadeInDown.springify()}>
          <Glass radius={22} style={{ padding: 16 }}>
            <Pressable onPress={() => setAnswer(null)} hitSlop={10} style={{ position: "absolute", right: 12, top: 12 }}>
              <SymbolView name="xmark" tintColor={t.mute} size={12} />
            </Pressable>
            <T kind="body">{answer}</T>
          </Glass>
        </Animated.View>
      )}
      {live && (
        <Animated.View entering={FadeInDown.springify()} layout={LinearTransition.springify()}>
          <Glass radius={999} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 8, flex: 1 }}>
              <Wave active={rec.state === "recording"} bars={9} color={rec.state === "paused" ? t.orange : t.red} height={20} />
              <Text style={{ fontSize: 16, fontVariant: ["tabular-nums"], color: t.fg }}>{rec.state === "paused" ? "Paused" : rec.state === "finishing" ? "Finishing…" : fmtClock(rec.elapsed)}</Text>
            </View>
            <Press onPress={rec.state === "paused" ? resume : pause} disabled={rec.state === "finishing"}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.bubble, alignItems: "center", justifyContent: "center" }}>
                <SymbolView name={rec.state === "paused" ? "play.fill" : "pause.fill"} tintColor={t.fg} size={18} />
              </View>
            </Press>
            <Press onPress={() => void stop()} disabled={rec.state === "finishing"}>
              <View style={{ height: 46, borderRadius: 23, paddingHorizontal: 18, backgroundColor: t.red, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                <SymbolView name="stop.fill" tintColor="#fff" size={14} />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Stop</Text>
              </View>
            </Press>
          </Glass>
        </Animated.View>
      )}
      {note.segments.length > 0 && (
        <Glass radius={999} style={{ flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6, paddingVertical: 6, gap: 6 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => void submit(q)}
            placeholder={asking ? "Thinking…" : "Ask this class anything"}
            placeholderTextColor={t.mute}
            returnKeyType="send"
            style={{ flex: 1, fontSize: 16, color: t.fg, paddingVertical: 8 }}
          />
          {live ? (
            <Pressable onPress={() => void submit("What did I miss? Summarise the last ten minutes in three bullets.")} style={{ backgroundColor: t.bubble, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: t.fg }}>What did I miss?</Text>
            </Pressable>
          ) : plan !== "pro" ? (
            <Text onPress={() => openPro("ask")} style={{ fontSize: 10.5, fontWeight: "700", color: t.clay, paddingHorizontal: 10 }}>PRO</Text>
          ) : null}
        </Glass>
      )}
    </View>
  );
}
