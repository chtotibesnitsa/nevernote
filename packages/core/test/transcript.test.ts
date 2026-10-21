import { describe, expect, it } from "vitest";
import { labelSpeakers, regroup, tokensToWords } from "../src/transcript.ts";

describe("transcript", () => {
  it("joins sub-word tokens into timed words", () => {
    expect(tokensToWords([" fe", "ll", "ow", " cats"], [0, 0.1, 0.2, 0.5], 10)).toEqual([
      { w: "fellow", t: 10 },
      { w: "cats", t: 10.5 },
    ]);
  });

  it("splits bubbles at sentence ends but not at p.m.", () => {
    const words = "Due at 5 p.m. on Friday. Got it?".split(" ").map((w, i) => ({ w, t: i * 0.3 }));
    expect(regroup(words, 3, "x").map((s) => s.text)).toEqual(["Due at 5 p.m. on Friday.", "Got it?"]);
  });

  it("names speakers in the order they are heard and smooths lone flips", () => {
    const words = ["one", "two", "three", "four", "five", "six"].map((w, i) => ({ w, t: i }));
    const segs = [{ id: "a", start: 0, end: 6, text: "", words }];
    const turns = [
      { start: -1, end: -0.5, speaker: 7 }, // a blip before anyone speaks
      { start: 0, end: 1.9, speaker: 3 },
      { start: 1.95, end: 2.2, speaker: 5 }, // "three" alone: a wobble
      { start: 2.2, end: 3.5, speaker: 3 },
      { start: 3.5, end: 6, speaker: 5 },
    ];
    const out = labelSpeakers(segs, turns, 6, "x");
    expect(out.map((s) => [s.speaker, s.text])).toEqual([
      ["S1", "one two three four"],
      ["S2", "five six"],
    ]);
  });
});
