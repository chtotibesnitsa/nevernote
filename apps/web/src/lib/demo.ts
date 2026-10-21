// Sample notes for screenshots and first-run exploration (?demo=1).
import { extract, type Note, type Segment } from "@nevernote/core";
import { local } from "./local.ts";

const APES: [string, string][] = [
  ["S1", "Alright everyone, let's get started. Today we're finishing unit 3 on the carbon cycle and then I'll go over what's due next week."],
  ["S1", "So, who can tell me where carbon is stored for the longest period of time?"],
  ["S2", "Sedimentary rock, like limestone?"],
  ["S1", "Good. Limestone holds on to carbon for millions of years. What about fossil fuels?"],
  ["S3", "Coal, oil and natural gas."],
  ["S1", "Exactly. Now, decomposition releases carbon dioxide back into the atmosphere through cellular respiration by bacteria and fungi."],
  ["S4", "Wait, so decomposition doesn't store carbon at all?"],
  ["S1", "Right, it's a source, not a sink. Write that down because it will be on the quiz."],
  ["S1", "Okay, logistics. Your lab report on the photosynthesis experiment is due Friday, October 24th at 11:59 p.m. on Canvas."],
  ["S3", "Is that the one with the spinach leaf disks?"],
  ["S1", "Yes, the leaf disk lab. Include your graph of oxygen production versus light intensity, and cite at least two sources."],
  ["S1", "We also have a unit 3 test next Tuesday. It's 40 multiple choice questions and two free response questions."],
];

const CHEM: [string, string][] = [
  ["S1", "Today we're talking about Le Chatelier's principle and how equilibrium systems respond to stress."],
  ["S1", "If you increase the concentration of a reactant, the equilibrium shifts to the right to use it up."],
  ["S2", "What happens if you increase the pressure?"],
  ["S1", "It shifts toward the side with fewer moles of gas. In the Haber process that means more ammonia."],
  ["S3", "So raising the temperature lowers the yield?"],
  ["S1", "Yes, because the reaction is exothermic. Problem set 7 is due Monday, and office hours are Wednesday at 3 p.m."],
];

const FILLER: [string, string][] = [
  ["S1", "Let's look at the diagram again and walk through each arrow, because this is where people lose points on the free response."],
  ["S1", "Notice how each reservoir has an input and an output, and the size of the arrow tells you the flux in gigatons per year."],
  ["S2", "Is the ocean bigger than the atmosphere as a reservoir?"],
  ["S1", "Much bigger. The deep ocean holds roughly fifty times more carbon than the atmosphere does."],
];

const SUMMARY = `### Long-term carbon sinks
- Sedimentary rock (limestone) stores carbon for **millions of years**
- Fossil fuels (coal, oil, natural gas) are the other major long-term store

### Decomposition
- Bacteria and fungi release CO₂ through cellular respiration
- Decomposition is a carbon **source, not a sink** (on the quiz)

### Logistics
- Leaf disk lab report: graph O₂ production vs. light intensity, cite 2+ sources
- Unit 3 test: 40 multiple choice + 2 FRQs`;

function build(id: string, title: string, folder: string, daysAgo: number, lines: [string, string][], withSummary: boolean): Note {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9, 37, 0, 0);
  let t = 2;
  // Pad to a realistic 45-minute lecture (~140 words a minute).
  const padded = [...lines];
  while (padded.reduce((a, [, x]) => a + x.split(" ").length, 0) < 6000) padded.push(...FILLER);
  const segments: Segment[] = padded.map(([speaker, text], i) => {
    const dur = text.split(" ").length / 2.35;
    const s = { id: `${id}-${i}`, start: t, end: t + dur, text, speaker };
    t += dur + 0.6;
    return s;
  });
  return {
    id, title, folder, createdAt: d.toISOString(), updatedAt: d.toISOString(), durationSec: t, device: daysAgo % 3 ? "mac" : "ios",
    stage: withSummary ? "ready" : "queued", segments,
    speakers: [{ id: "S1", name: "Ms. Rivera", share: 0.7 }, { id: "S2", name: "Jordan", share: 0.1 }, { id: "S3", name: "S3", share: 0.1 }, { id: "S4", name: "S4", share: 0.1 }],
    extractions: extract(segments, d), thoughts: "",
    summary: withSummary
      ? {
          title, notes: SUMMARY, model: "google/gemini-2.5-flash-lite", createdAt: d.toISOString(), extractions: [],
          studyGuide: [
            { question: "Where is carbon stored the longest?", answer: "Sedimentary rock such as limestone, for millions of years." },
            { question: "Is decomposition a carbon source or sink?", answer: "A source: decomposers release CO₂ through cellular respiration." },
            { question: "What do the 3 stages of the nitrogen cycle convert?", answer: "Fixation: N₂ → NH₃. Nitrification: NH₃ → NO₂⁻ → NO₃⁻. Denitrification: NO₃⁻ → N₂." },
            { question: "What should the leaf disk lab graph show?", answer: "Oxygen production versus light intensity." },
          ],
          keyTerms: [
            { term: "Carbon sink", definition: "A reservoir that stores more carbon than it releases." },
            { term: "Cellular respiration", definition: "How organisms, including decomposers, turn sugars into energy, releasing CO₂." },
          ],
        }
      : undefined,
  };
}

export async function seedDemo(): Promise<void> {
  const notes = [
    build("demo-apes-21", "APES Notes 10/21", "APES", 0, APES, true),
    build("demo-apes-20", "APES Notes 10/20", "APES", 1, APES.slice(1, 8), true),
    build("demo-chem-20", "Chem: Le Chatelier", "AP Chem", 1, CHEM, false),
    build("demo-apes-16", "APES Notes 10/16 REVIEW", "APES", 5, APES.slice(1, 7), true),
    build("demo-info-14", "UMaryland Info Session", "College", 7, APES.slice(0, 4), true),
    build("demo-water-14", "APES Water Cycle 1.8", "APES", 7, APES.slice(3, 10), true),
  ];
  for (let i = 8; i < 60; i++) if (i % 7 !== 0 && i % 7 !== 6) notes.push(build(`demo-old-${i}`, `${i % 2 ? "APES" : "AP Chem"} ${i}`, i % 2 ? "APES" : "AP Chem", i, (i % 2 ? APES.slice(1, 5) : CHEM.slice(0, 3)), true));
  for (const n of notes) await local.put(n);
}
