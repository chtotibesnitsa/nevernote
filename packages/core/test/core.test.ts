import { describe, expect, it } from "vitest";
import { recordUpsell, shouldUpsell, summaryRoute } from "../src/plans.ts";
import { insights, streaks } from "../src/stats.ts";
import { mergeExtractions, parseSummary } from "../src/summarize.ts";
import { Syncer, mergeNote, type Remote, type Store } from "../src/sync.ts";
import type { Extraction, Note } from "../src/types.ts";

const note = (over: Partial<Note> = {}): Note => ({
  id: "n1",
  title: "APES 10/21",
  createdAt: "2026-10-21T13:37:00.000Z",
  updatedAt: "2026-10-21T14:00:00.000Z",
  durationSec: 600,
  device: "mac",
  stage: "ready",
  segments: [{ id: "a", start: 0, end: 5, text: "Limestone holds carbon for millions of years.", speaker: "S1" }],
  speakers: [{ id: "S1", name: "Teacher", share: 1 }],
  extractions: [],
  thoughts: "",
  ...over,
});

describe("stats", () => {
  it("counts words, wpm and books", () => {
    const i = insights([note(), note({ id: "n2", durationSec: 60, device: "ios" })], new Date(2026, 9, 21));
    expect(i.totalWords).toBe(14);
    expect(i.wpm).toBe(1);
    expect(i.byDevice.ios).toBe(7);
  });
  it("keeps streaks across weekends", () => {
    // Thu, Fri, (Sat, Sun skipped), Mon
    expect(streaks(["2026-10-15", "2026-10-16", "2026-10-19"], new Date(2026, 9, 19)).current).toBe(3);
    // a missed Tuesday breaks it
    expect(streaks(["2026-10-12", "2026-10-14"], new Date(2026, 9, 14)).current).toBe(1);
    // today not recorded yet doesn't break it
    expect(streaks(["2026-10-19", "2026-10-20"], new Date(2026, 9, 21)).current).toBe(2);
  });
});

describe("plans", () => {
  const now = new Date("2026-10-21T15:00:00Z");
  const base = { installedAt: "2026-10-01T00:00:00Z", shownCount: 0, dismissedInARow: 0 };
  it("routes free summaries past the daily limit to sponsored-or-overnight", () => {
    expect(summaryRoute("free", 0)).toBe("instant");
    expect(summaryRoute("free", 4)).toBe("instant");
    expect(summaryRoute("free", 5)).toBe("sponsored-or-overnight");
    expect(summaryRoute("pro", 99)).toBe("instant");
  });
  it("never upsells new users, pro users, or while recording", () => {
    expect(shouldUpsell("free", "deadlineFound", { ...base, installedAt: "2026-10-21T00:00:00Z" }, now).show).toBe(false);
    expect(shouldUpsell("pro", "deadlineFound", base, now).show).toBe(false);
    expect(shouldUpsell("free", "deadlineFound", base, now, true).show).toBe(false);
    expect(shouldUpsell("free", "deadlineFound", base, now).show).toBe(true);
  });
  it("waits three days between nudges and snoozes after three dismissals", () => {
    let s = recordUpsell(base, now, true);
    expect(shouldUpsell("free", "summaryReady", s, new Date("2026-10-23T15:00:00Z")).show).toBe(false);
    expect(shouldUpsell("free", "summaryReady", s, new Date("2026-10-25T15:00:00Z")).show).toBe(true);
    s = recordUpsell(recordUpsell(s, now, true), now, true);
    expect(shouldUpsell("free", "summaryReady", s, new Date("2026-11-10T15:00:00Z")).show).toBe(false);
    expect(shouldUpsell("free", "summaryReady", s, new Date("2026-11-25T15:00:00Z")).show).toBe(true);
  });
});

describe("summaries", () => {
  it("parses fenced model output and links quotes to segments", () => {
    const raw = '```json\n{"title":"Carbon","notes":"### Sinks\\n- Limestone","studyGuide":[{"question":"Q","answer":"A"}],"keyTerms":[],"items":[{"kind":"exam","title":"Unit 3 test","date":"2026-10-27","time":null,"quote":"Limestone holds carbon"}]}\n```';
    const s = parseSummary(raw, "test-model", note().segments);
    expect(s.title).toBe("Carbon");
    expect(s.extractions[0]).toMatchObject({ kind: "exam", when: "2026-10-27", allDay: true, segmentId: "a" });
  });
  it("prefers AI items and keeps keyword items the AI missed", () => {
    const k = (kind: Extraction["kind"], when?: string): Extraction => ({ id: kind + when, kind, title: kind, when, allDay: true, phrase: "", confidence: 0.8, source: "keywords" });
    const merged = mergeExtractions([k("exam", "2026-10-27"), k("event", "2026-11-03")], [{ ...k("exam", "2026-10-27"), source: "ai" }]);
    expect(merged.map((m) => `${m.kind}:${m.source}`)).toEqual(["exam:ai", "event:keywords"]);
  });
});

describe("sync", () => {
  it("merges segments from two devices and keeps the newest title", () => {
    const a = note({ title: "old", updatedAt: "2026-10-21T14:00:00Z" });
    const b = note({ title: "new", updatedAt: "2026-10-21T15:00:00Z", segments: [{ id: "b", start: 6, end: 9, text: "Fossil fuels." }] });
    const m = mergeNote(a, b);
    expect(m.title).toBe("new");
    expect(m.segments.map((s) => s.id)).toEqual(["a", "b"]);
  });
  it("pushes dirty notes, skips live recordings, and pulls remote ones", async () => {
    const db = new Map<string, Note>([
      ["n1", note()],
      ["live", note({ id: "live", stage: "recording" })],
    ]);
    const meta = new Map<string, string>();
    const store: Store = {
      get: async (id) => db.get(id),
      put: async (n) => void db.set(n.id, n),
      list: async () => [...db.values()],
      getMeta: async (k) => meta.get(k),
      setMeta: async (k, v) => void meta.set(k, v),
    };
    const pushed: string[] = [];
    let pulled = 0;
    const remote: Remote = {
      push: async (ns) => void pushed.push(...ns.map((n) => n.id)),
      pull: async () => (pulled++ ? { notes: [] } : { notes: [note({ id: "phone", device: "ios" })], cursor: "c1" }),
    };
    const states: string[] = [];
    await new Syncer(store, remote, (s) => states.push(s)).run(true);
    expect(pushed).toEqual(["n1"]);
    expect(db.has("phone")).toBe(true);
    expect(meta.get("cursor")).toBe("c1");
    expect(states).toEqual(["syncing", "synced"]);
  });
});

describe("deletion sync", () => {
  it("a delete on any device wins and carries no content", async () => {
    const { mergeNote, tombstone } = await import("../src/sync.ts");
    const base = {
      id: "n1", title: "Bio", createdAt: "2026-10-21T10:00:00Z", updatedAt: "2026-10-21T10:00:00Z", durationSec: 60, device: "ios" as const,
      stage: "ready" as const, segments: [{ id: "a", start: 0, end: 1, text: "hello" }], speakers: [], extractions: [], thoughts: "mine",
    };
    const gone = tombstone(base);
    expect(gone.segments).toEqual([]);
    expect(gone.thoughts).toBe("");
    // An older, un-deleted copy arriving later must not resurrect it.
    expect(mergeNote(gone, { ...base, updatedAt: "2026-10-21T09:00:00Z" }).deleted).toBe(true);
  });
});

import { cleanPrefs, styleInstructions } from "../src/styles.ts";
import { summaryMessages as sm } from "../src/summarize.ts";

describe("summary styles", () => {
  it("caps custom rules by plan and drops class presets for free", () => {
    const long = "x".repeat(5000);
    const free = cleanPrefs({ style: "cornell", rules: long, presets: [{ folder: "Bio", rules: "a" }] }, "free");
    expect(free.rules!.length).toBe(300);
    expect(free.presets).toEqual([]);
    const pro = cleanPrefs({ style: "cornell", rules: long, presets: [{ folder: "Bio", rules: "list formulas" }] }, "pro");
    expect(pro.rules!.length).toBe(2000);
    expect(pro.presets).toEqual([{ folder: "Bio", rules: "list formulas" }]);
  });
  it("falls back to the standard style for unknown values", () => {
    expect(cleanPrefs({ style: "nope" }, "free").style).toBe("standard");
  });
  it("adds style hints and class rules to the prompt without touching the JSON format", () => {
    const prefs = cleanPrefs({ style: "outline", rules: "Bold every date", presets: [{ folder: "Bio", rules: "Explain terms" }] }, "pro");
    const text = styleInstructions(prefs, "bio");
    expect(text).toContain("nested bullet outline");
    expect(text).toContain("Bold every date Explain terms");
    const msgs = sm([{ id: "1", start: 0, end: 1, text: "hello" }], new Date(), { style: text });
    expect(msgs[0].content).toContain("Return ONLY a JSON object");
    expect(msgs[0].content).toContain("Bold every date");
  });
});

import { answer, comingUp, needsReview, reviewQueue } from "../src/review.ts";
describe("daily review", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const note = (extractions: any[]) => ({ id: "n", title: "Bio", createdAt: "2026-10-23T09:00:00Z", updatedAt: "", durationSec: 0, device: "web", stage: "ready", segments: [], speakers: [], extractions, thoughts: "" }) as any;
  const kw = { id: "a", kind: "deadline", title: "Lab report", when: "2026-10-27", allDay: true, phrase: "lab report due monday", confidence: 0.8, source: "keywords" };
  const ai = { ...kw, id: "b", confidence: 0.9, source: "ai", when: "2026-10-28" };
  it("asks about keyword guesses and undated items, not confident AI ones", () => {
    expect(needsReview(kw as any, now)).toBe(true);
    expect(needsReview({ ...ai, when: undefined } as any, now)).toBe(true);
    expect(needsReview(ai as any, now)).toBe(false);
    expect(needsReview({ ...kw, kind: "important" } as any, now)).toBe(false);
    expect(needsReview({ ...kw, when: "2026-10-01" } as any, now)).toBe(false);
  });
  it("confirming tracks it, dismissing hides it", () => {
    const n = note([kw, ai]);
    expect(reviewQueue([n], now).map((p) => p.e.id)).toEqual(["a"]);
    expect(comingUp([n], now).map((p) => p.e.id)).toEqual(["b"]);
    const yes = { ...n, extractions: answer(n, "a", "confirmed") };
    expect(reviewQueue([yes], now)).toEqual([]);
    expect(comingUp([yes], now).map((p) => p.e.id)).toEqual(["a", "b"]);
    const no = { ...n, extractions: answer(n, "b", "dismissed") };
    expect(comingUp([no], now)).toEqual([]);
  });
});
