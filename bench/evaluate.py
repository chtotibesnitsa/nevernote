"""Scores transcription accuracy and speaker labelling on every trial.

Usage:
  python3 bench/evaluate.py --models ~/models --trials ~/trials --asr parakeet whisper-base.en moonshine
  python3 bench/evaluate.py --wav lecture.wav --ref lecture.txt      # your own recording vs a known transcript

Word error rate uses the Whisper English normalizer (case, punctuation and
number formats don't count as errors). Speaker accuracy is the share of
reference speech time given to the right speaker under the best one-to-one
mapping of predicted speakers to real ones.
"""

import argparse
import glob
import json
import os
import re

import jiwer
import numpy as np
import soundfile as sf
from scipy.optimize import linear_sum_assignment
from whisper_normalizer.english import EnglishTextNormalizer

import pipeline

norm = EnglishTextNormalizer()


def pre(t):
    # "11.59 pm" and "7.30" are clock times, "costs$25" is a spacing slip;
    # none of them are recognition errors a student would notice.
    t = re.sub(r"(\d{1,2})\.(\d{2})\b", r"\1:\2", t)
    return re.sub(r"(\w)\$", r"\1 $", t)


def wer(ref, hyp):
    r, h = norm(pre(ref)), norm(pre(hyp))
    o = jiwer.process_words(r, h)
    return o.wer, o


def speaker_accuracy(ref_segs, hyp_segs):
    rs = sorted({s["speaker"] for s in ref_segs})
    hs = sorted({s["speaker"] for s in hyp_segs})
    m = np.zeros((len(rs), len(hs)))
    for r in ref_segs:
        for h in hyp_segs:
            ov = min(r["end"], h["end"]) - max(r["start"], h["start"])
            if ov > 0:
                m[rs.index(r["speaker"]), hs.index(h["speaker"])] += ov
    ri, hi = linear_sum_assignment(-m)
    total = sum(r["end"] - r["start"] for r in ref_segs)
    return float(m[ri, hi].sum() / total), len(rs), len(hs)


def load(path):
    a, sr = sf.read(path, dtype="float32")
    if a.ndim > 1:
        a = a.mean(axis=1)
    if sr != pipeline.SR:
        n = int(len(a) * pipeline.SR / sr)
        a = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.path.expanduser("~/models"))
    ap.add_argument("--trials", default="bench/trials")
    ap.add_argument("--asr", nargs="+", default=["parakeet"])
    ap.add_argument("--denoise", action="store_true")
    ap.add_argument("--embedding", default="titanet")
    ap.add_argument("--threshold", type=float, default=0.6)
    ap.add_argument("--no-diarize", action="store_true")
    ap.add_argument("--vad-threshold", type=float, default=0.35)
    ap.add_argument("--no-rescue", action="store_true")
    ap.add_argument("--chunker", default="vad", choices=["vad", "fixed"])
    ap.add_argument("--asr-on", default="raw", choices=["raw", "clean"])
    ap.add_argument("--wav")
    ap.add_argument("--ref")
    ap.add_argument("--out", default="bench/results.json")
    args = ap.parse_args()

    if args.wav:
        jobs = [(args.wav, {"text": open(args.ref).read()})]
    else:
        jobs = []
        for w in sorted(glob.glob(f"{args.trials}/*.wav")):
            j = w[:-4] + ".json"
            if os.path.exists(j):
                ref = json.load(open(j))
            else:
                ref = {"text": open(w[:-4] + ".txt").read()}
            jobs.append((w, ref))

    rows = []
    diar = None if args.no_diarize else pipeline.diarizer(args.models, args.embedding, args.threshold)
    for asr in args.asr:
        rec = pipeline.recognizer(args.models, asr)
        for w, ref in jobs:
            audio = load(w)
            multi = "segments" in ref
            segs, timing = pipeline.transcribe(
                args.models, audio, asr=asr, denoise=args.denoise,
                diarize=multi and not args.no_diarize, rec=rec, diar=diar,
                vad_threshold=args.vad_threshold, asr_on=args.asr_on, chunker=args.chunker, rescue_gaps=not args.no_rescue)
            ref_text = " ".join(s["text"] for s in ref["segments"]) if multi else ref["text"]
            hyp_text = " ".join(s["text"] for s in segs)
            e, o = wer(ref_text, hyp_text)
            row = {
                "trial": os.path.basename(w)[:-4], "asr": asr, "denoise": args.denoise, "asr_on": args.asr_on, "vad": args.vad_threshold,
                "wer": round(e, 4), "sub": o.substitutions, "del": o.deletions, "ins": o.insertions,
                "ref_words": len(norm(ref_text).split()),
                "rtf": round(timing["total_seconds"] / timing["audio_seconds"], 3),
            }
            if multi and not args.no_diarize:
                acc, nr, nh = speaker_accuracy(ref["segments"], segs)
                row.update(speaker_acc=round(acc, 3), speakers_true=nr, speakers_found=nh)
            rows.append(row)
            print(json.dumps(row), flush=True)
            if os.environ.get("SHOW_DIFF"):
                print(jiwer.visualize_alignment(o, show_measures=False)[:4000])
    with open(args.out, "w") as f:
        json.dump(rows, f, indent=1)


if __name__ == "__main__":
    main()
