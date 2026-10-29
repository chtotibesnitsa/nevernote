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
    const ics = icsFor([{ id: "a", kind: "deadline", title: "Lab report", phrase: "due Friday", when: "2026-10-23T23:59:00", course: "Biology" } as never], undefined, "NoteLater due dates");
    expect(ics).toContain("X-WR-CALNAME:NoteLater due dates");
    expect(ics).toContain("SUMMARY:Biology: Lab report");
  });
});

import { classTerms, fixTerms, subjectsOf } from "../src/vocab.ts";
describe("class vocabulary", () => {
  it("picks subjects from a class name", () => {
    expect(subjectsOf("APES period 3")).toContain("environmental");
    expect(subjectsOf("AP Chem")).toEqual(["chemistry"]);
  });
  it("puts names first and stays under the cap", () => {
    const t = classTerms("AP Bio", 50, ["Ms. Rivera"]);
    expect(t[0]).toBe("Ms. Rivera");
    expect(t).toContain("mitosis");
    expect(t.length).toBe(50);
  });
  it("adds no subject terms when the class name gives no subject", () => {
    expect(classTerms("Class 10/27", 100, ["Mr. Wang"])).toEqual(["Mr. Wang"]);
  });
  it("spells terms properly without touching ordinary words", () => {
    const terms = classTerms("AP Chem", 200);
    expect(fixTerms("le chateliers principle says the dna and ph change", [...terms, "DNA"])).toBe("Le Chatelier's principle says the DNA and pH change");
    expect(fixTerms("we went to the base of the hill", terms)).toBe("we went to the base of the hill");
  });
});

import { cleanAsrText, tidyPhrase } from "../src/transcript.ts";
describe("phrase tidying", () => {
  it("keeps a looped word or phrase once", () => {
    expect(tidyPhrase("they testified before Congress Congress Congress about it")).toBe("they testified before Congress about it");
    expect(tidyPhrase("go team go team go team go team")).toBe("go team");
    expect(cleanAsrText("we need to talk we need to talk we need to talk now")).toBe("we need to talk now");
  });
  it("keeps natural repeats and drops filler-only phrases", () => {
    expect(tidyPhrase("this past weekend the weekend before")).toBe("this past weekend the weekend before");
    expect(tidyPhrase("very very good")).toBe("very very good");
    expect(tidyPhrase("Um")).toBe("");
    expect(tidyPhrase("uh um")).toBe("");
  });
});
