import { describe, expect, it } from "vitest";
import { findDates, toLocalISO } from "../src/dates.ts";
import { extract } from "../src/extract.ts";
import { digitize } from "../src/numwords.ts";

// Wednesday, October 21 2026, 9:37 a.m. (the day of the APES screenshot)
const REF = new Date(2026, 9, 21, 9, 37);
const iso = (t: string) => findDates(t, REF).map((h) => toLocalISO(h.date, !h.hasTime));

describe("digitize", () => {
  it("turns spoken dates and times into digits", () => {
    expect(digitize("due Friday, October twenty fourth, by eleven fifty nine p.m.")).toBe("due Friday, October 24th, by 11:59 p.m.");
    expect(digitize("the bus leaves at seven thirty a.m. sharp")).toBe("the bus leaves at 7:30 a.m. sharp");
    expect(digitize("due November third")).toBe("due November 3rd");
    expect(digitize("on the fifth of December")).toBe("on the 5th of December");
  });
  it("leaves ordinary speech alone", () => {
    expect(digitize("One more thing. The second law of thermodynamics.")).toBe("One more thing. The second law of thermodynamics.");
    expect(digitize("forty multiple choice questions and two free response")).toBe("forty multiple choice questions and two free response");
  });
});

describe("findDates", () => {
  it("resolves month-day phrases, with and without times", () => {
    expect(iso("due Friday, October 24th, by 11:59 p.m.")).toEqual(["2026-10-24T23:59:00"]);
    expect(iso("the permission slip is due November third")).toEqual(["2026-11-03"]);
    expect(iso("due 10/30")).toEqual(["2026-10-30"]);
    expect(iso("the final is January 12th")).toEqual(["2027-01-12"]);
  });
  it("resolves weekdays the way teachers mean them", () => {
    expect(iso("quiz Friday")).toEqual(["2026-10-23"]);
    expect(iso("unit test next Tuesday")).toEqual(["2026-10-27"]);
    expect(iso("quiz this Friday")).toEqual(["2026-10-23"]);
    expect(iso("lab next Friday")).toEqual(["2026-10-30"]);
    expect(iso("essay due this Wednesday")).toEqual(["2026-10-21"]);
    expect(iso("problem set due Monday")).toEqual(["2026-10-26"]);
  });
  it("resolves relative phrases", () => {
    expect(iso("read chapter 4 by tomorrow")).toEqual(["2026-10-22"]);
    expect(iso("submit it tonight")).toEqual(["2026-10-21T23:59:00"]);
    expect(iso("project due in two weeks")).toEqual(["2026-11-04"]);
    expect(iso("office hours Thursday at 3 p.m.")).toEqual(["2026-10-22T15:00:00"]);
  });
});

describe("extract", () => {
  const segs = [
    "Okay, logistics. Your lab report on the photosynthesis experiment is due Friday, October twenty fourth, by eleven fifty nine p.m. on Canvas.",
    "We also have a unit three test next Tuesday. It's forty multiple choice questions and two free response questions.",
    "Right, it's a source, not a sink. Write that down because it will be on the quiz.",
    "The field trip permission slip for the Chesapeake Bay watershed trip is due November third, and it costs twenty five dollars.",
    "Problem set seven is due Monday, and office hours are Wednesday from three to four thirty in room two fourteen.",
    "Holding onto carbon for millions of years.",
  ].map((text, i) => ({ id: `s${i}`, start: i * 10, end: i * 10 + 9, text }));
  const items = extract(segs, REF);
  const by = (k: string) => items.filter((x) => x.kind === k);

  it("finds the lab report deadline with its time", () => {
    const lab = items.find((x) => /lab report/i.test(x.title));
    expect(lab?.when).toBe("2026-10-24T23:59:00");
    expect(lab?.segmentId).toBe("s0");
  });
  it("finds the test", () => {
    expect(by("exam").map((x) => x.when)).toContain("2026-10-27");
  });
  it("flags 'it will be on the quiz' as important", () => {
    expect(by("important").some((x) => x.segmentId === "s2")).toBe(true);
  });
  it("finds the permission slip and the problem set", () => {
    expect(items.find((x) => /permission slip/i.test(x.title))?.when).toBe("2026-11-03");
    expect(items.find((x) => /problem set/i.test(x.title))?.when).toBe("2026-10-26");
  });
  it("doesn't treat a preview of what's due as a deadline", () => {
    const x = extract([{ id: "p", start: 0, end: 1, text: "Today we're finishing unit 3 and then I'll go over what's due next week." }], REF);
    expect(x).toEqual([]);
    const y = extract([{ id: "q", start: 0, end: 1, text: "The reading is due by Thursday." }], REF);
    expect(y[0]?.when).toBe("2026-10-22");
  });
  it("ignores ordinary content", () => {
    expect(items.some((x) => x.segmentId === "s5")).toBe(false);
  });
});

describe("extract on unpunctuated live speech", () => {
  const ref = new Date(2026, 9, 23, 10);
  const seg = (text: string) => [{ id: "a", start: 0, end: 5, text }];
  it("doesn't turn lecture phrases into reminders", () => {
    expect(extract(seg("But Alex you have to understand"), ref)).toEqual([]);
    expect(extract(seg("so the way I'm explaining it is you have to take what you have to do is you have to take a step back"), ref)).toEqual([]);
  });
  it("still catches real to-dos", () => {
    expect(extract(seg("you have to bring your calculator"), ref)[0]?.kind).toBe("reminder");
  });
  it("keeps only the words around a match in a long run-on line", () => {
    const filler = "and then we talked about the farms and the cities and the people who live there ".repeat(4);
    const [e] = extract(seg(`${filler}the lab report is due Friday ${filler}`), ref);
    expect(e.kind).toBe("deadline");
    expect(e.phrase.split(" ").length).toBeLessThan(35);
  });
});
