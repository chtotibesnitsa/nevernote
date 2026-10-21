"""Turns evaluate.py results into the README table and the website's numbers.

Usage:
  python3 bench/report.py parakeet=results.json moonshine=results_gain8.json whisper-base.en=results_gain8.json

Each model is read from the results file named for it, so every engine can be
scored at its own best setting. Accepts the JSON written by --out or the
JSON-lines log printed while it runs.
"""

import json
import sys
from collections import defaultdict

TIERS = [
    ("real", "Real speech"),
    ("t0_clean", "Quiet room"),
    ("t1_room", "Echoey room"),
    ("t2_classroom", "Classroom noise"),
    ("t3_noisy", "Loud room"),
    ("t4_brutal", "Brutal"),
]
NAMES = {"parakeet": "Nevernote · Parakeet", "moonshine": "Moonshine base", "whisper-base.en": "Whisper base"}


def load(path):
    text = open(path).read().strip()
    if text.startswith("["):
        return json.loads(text)
    return [json.loads(l) for l in text.splitlines() if l.startswith("{")]


def tier(trial):
    return trial.split("_", 1)[1] if "_t" in trial else "real"


def main():
    rows = {}
    for arg in sys.argv[1:]:
        asr, path = arg.split("=", 1)
        g = defaultdict(list)
        for r in load(path):
            if r["asr"] == asr:
                g[tier(r["trial"])].append(r)
        wer = {}
        spk = {}
        for k, rs in g.items():
            wer[k] = 100 * sum(r["wer"] * r["ref_words"] for r in rs) / sum(r["ref_words"] for r in rs)
            s = [r["speaker_acc"] for r in rs if "speaker_acc" in r]
            if s:
                spk[k] = 100 * sum(s) / len(s)
        rtf = [r["rtf"] for rs in g.values() for r in rs]
        rows[asr] = {"wer": wer, "spk": spk, "rtf": sum(rtf) / max(1, len(rtf))}

    print("| Engine | " + " | ".join(n for _, n in TIERS) + " | Speed |")
    print("|---|" + "---:|" * (len(TIERS) + 1))
    for asr, r in rows.items():
        cells = [f"{r['wer'][k]:.1f}%" if k in r["wer"] else "—" for k, _ in TIERS]
        print(f"| {NAMES.get(asr, asr)} | " + " | ".join(cells) + f" | {1 / r['rtf']:.1f}× real time |")
    first = next(iter(rows.values()))
    print("\nSpeaker accuracy (share of speech time given to the right speaker):")
    print("| " + " | ".join(n for k, n in TIERS if k in first["spk"]) + " |")
    print("|" + "---:|" * len(first["spk"]))
    print("| " + " | ".join(f"{first['spk'][k]:.0f}%" for k, _ in TIERS if k in first["spk"]) + " |")

    site = {
        "tiers": [n for k, n in TIERS if k != "t4_brutal"],
        "rows": [
            {"engine": NAMES.get(a, a), "ours": a == "parakeet", "wer": [f"{r['wer'][k]:.1f}%" if k in r["wer"] else "—" for k, _ in TIERS if k != "t4_brutal"]}
            for a, r in rows.items()
        ],
    }
    print("\nwebsite:", json.dumps(site))


if __name__ == "__main__":
    main()
