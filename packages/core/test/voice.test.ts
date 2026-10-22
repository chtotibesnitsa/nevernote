import { describe, expect, it } from "vitest";
import { nameSpeakers, SpeakerTracker, voiceprint } from "../src/voice.ts";

// A buzzy "voice": harmonics of f0 with a formant-ish tilt.
function voice(f0: number, tilt: number, sec = 1.2): Float32Array {
  const n = Math.floor(16000 * sec);
  const out = new Float32Array(n);
  for (let h = 1; h * f0 < 4000; h++) {
    const amp = 1 / Math.pow(h, tilt);
    for (let i = 0; i < n; i++) out[i] += amp * Math.sin((2 * Math.PI * f0 * h * i) / 16000);
  }
  return out.map((v) => v * 0.2);
}

describe("voice clustering", () => {
  it("separates a low and a high voice and keeps repeats together", () => {
    const t = new SpeakerTracker();
    const a1 = t.assign(voiceprint(voice(110, 1.0)));
    const b1 = t.assign(voiceprint(voice(230, 1.6)));
    const a2 = t.assign(voiceprint(voice(112, 1.0)));
    const b2 = t.assign(voiceprint(voice(228, 1.6)));
    expect(a1).toBe("S1");
    expect(b1).toBe("S2");
    expect(a2).toBe(a1);
    expect(b2).toBe(b1);
  });
  it("returns null for silence", () => {
    expect(voiceprint(new Float32Array(16000))).toBeNull();
  });
});

describe("names from speech", () => {
  it("takes self introductions and replies", () => {
    const names = nameSpeakers([
      { speaker: "S1", text: "Good morning everyone, my name is Mr. Chen and I'll be your teacher." },
      { speaker: "S2", text: "Hi I'm Maya." },
      { speaker: "S1", text: "Thanks, Jordan, can you read the next one?" },
      { speaker: "S3", text: "Sure, reading now." },
    ]);
    expect(names).toEqual({ S1: "Mr. Chen", S2: "Maya", S3: "Jordan" });
  });
  it("ignores filler words", () => {
    expect(nameSpeakers([{ speaker: "S1", text: "Okay, so I'm Going to start." }, { speaker: "S2", text: "Thanks, Everyone." }])).toEqual({});
  });
});
