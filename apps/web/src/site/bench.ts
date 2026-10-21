// Filled from bench/results.json (python3 bench/evaluate.py). Kept as data so
// the site and the README quote the same numbers.
export const BENCH = {
  tiers: ["Real speech", "Quiet room", "Echoey room", "Classroom noise", "Loud room"],
  rows: [
    { engine: "Nevernote · Parakeet", ours: true, wer: ["—", "—", "—", "—", "—"] },
    { engine: "Moonshine base", ours: false, wer: ["—", "—", "—", "—", "—"] },
    { engine: "Whisper base", ours: false, wer: ["—", "—", "—", "—", "—"] },
  ],
  note: "Real speech: LibriSpeech and JFK clips. Rooms: two synthetic lectures with 4-6 speakers, averaged.",
};
