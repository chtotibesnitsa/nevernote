import { describe, expect, it } from "vitest";
import { icsFor, tierCan, unlockStep } from "../src/index.ts";

describe("tiers", () => {
  it("never limits recording or transcription, even for guests", () => {
    for (const f of ["record", "transcribe", "speakers", "keywordReminders"] as const) expect(tierCan("guest", f)).toBe(true);
  });
  it("asks guests to sign up for AI notes, sync and insights", () => {
    for (const f of ["summary", "studyGuide", "sync", "insights", "calendarFile"] as const) {
      expect(tierCan("guest", f)).toBe(false);
      expect(unlockStep("guest", f)).toBe("signup");
      expect(tierCan("free", f)).toBe(true);
    }
  });
  it("keeps Pro features for Pro, and sends guests to sign up first", () => {
    for (const f of ["askNotes", "calendarSync", "examPack", "export", "flashcards"] as const) {
      expect(unlockStep("free", f)).toBe("pro");
      expect(unlockStep("guest", f)).toBe("signup");
      expect(tierCan("pro", f)).toBe(true);
    }
  });
});

describe("calendar feed", () => {
  it("names the calendar and prefixes each event with its class", () => {
    const ics = icsFor([{ id: "a", kind: "deadline", title: "Lab report", phrase: "due Friday", when: "2026-10-23T23:59:00", course: "Biology" } as never], undefined, "Nevernote due dates");
    expect(ics).toContain("X-WR-CALNAME:Nevernote due dates");
    expect(ics).toContain("SUMMARY:Biology: Lab report");
  });
});
