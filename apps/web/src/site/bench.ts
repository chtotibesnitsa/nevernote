// Filled from bench/report.py (see bench/README.md). Kept as data so
// the site and the README quote the same numbers.
export const BENCH = {
  tiers: ["Real speech", "Quiet room", "Echoey room", "Classroom noise", "Loud room"],
  rows: [
    { engine: "NoteLater · Parakeet", ours: true, wer: ["2.0%", "4.2%", "3.7%", "12.8%", "24.1%"] },
    { engine: "Moonshine base", ours: false, wer: ["6.1%", "4.9%", "6.6%", "27.1%", "58.2%"] },
    { engine: "Whisper base", ours: false, wer: ["7.1%", "10.6%", "5.4%", "19.7%", "52.2%"] },
  ],
  note: "Real speech: LibriSpeech and JFK clips. Rooms: two synthetic lectures with 4-6 speakers, averaged.",
};
