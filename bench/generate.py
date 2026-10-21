"""Builds the synthetic classroom trials: one clean recording plus progressively
harder versions of it (room reverb, far-away students, chatter, HVAC hum,
overlapping speech, phone-quality audio).

Usage: python3 bench/generate.py --models ~/models --out bench/trials
"""

import argparse
import json
import os

import numpy as np
import sherpa_onnx
import soundfile as sf

from scripts import APES, CHEM

SR = 16000
rng = np.random.default_rng(7)


def tts(models):
    d = os.path.join(models, "kokoro-en-v0_19")
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f"{d}/model.onnx",
                voices=f"{d}/voices.bin",
                tokens=f"{d}/tokens.txt",
                data_dir=f"{d}/espeak-ng-data",
            ),
            num_threads=4,
        )
    )
    return sherpa_onnx.OfflineTts(cfg)


def resample(x, src, dst):
    if src == dst:
        return x
    n = int(len(x) * dst / src)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def say(engine, sid, text, speed=1.0):
    a = engine.generate(text, sid=sid, speed=speed)
    return resample(np.array(a.samples, dtype=np.float32), a.sample_rate, SR)


def room_ir(rt60):
    n = int(SR * rt60)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / rt60)
    ir[0] = 1.0
    return (ir / np.sqrt(np.sum(ir**2))).astype(np.float32)


def reverb(x, rt60):
    if rt60 <= 0:
        return x
    y = np.convolve(x, room_ir(rt60))[: len(x)]
    return y * (np.max(np.abs(x)) / (np.max(np.abs(y)) + 1e-9))


def pink(n):
    w = rng.standard_normal(n)
    f = np.fft.rfft(w)
    f /= np.sqrt(np.arange(1, len(f) + 1))
    p = np.fft.irfft(f, n)
    return (p / np.std(p)).astype(np.float32)


def rms(x):
    return float(np.sqrt(np.mean(x**2)) + 1e-12)


def bandpass_phone(x):
    f = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    f[(freqs < 300) | (freqs > 3400)] = 0
    y = np.fft.irfft(f, len(x)).astype(np.float32)
    return resample(resample(y, SR, 8000), 8000, SR)


TIERS = {
    # name: (rt60, student_gain_db, snr_db, babble, hum, overlap_prob, phone, clip)
    "t0_clean": (0.0, 0, None, False, False, 0.0, False, False),
    "t1_room": (0.45, -8, 28, False, False, 0.0, False, False),
    "t2_classroom": (0.7, -12, 15, True, True, 0.05, False, False),
    "t3_noisy": (0.9, -16, 8, True, True, 0.15, False, False),
    "t4_brutal": (1.1, -20, 3, True, True, 0.25, True, True),
}


def render(lines, clips, tier, babble_bed):
    rt60, sgain, snr, babble, hum, overlap, phone, clip = TIERS[tier]
    teacher = lines[0][0]
    total = sum(len(c) for c in clips) + SR * len(clips) + SR * 2
    mix = np.zeros(total, dtype=np.float32)
    refs = []
    t = int(0.5 * SR)
    for (sid, text), c in zip(lines, clips):
        g = 1.0 if sid == teacher else 10 ** (sgain / 20)
        c = reverb(c, rt60 * (1.0 if sid == teacher else 1.3)) * g
        if refs and rng.random() < overlap:
            t = max(refs[-1]["start_sample"] + SR // 2, t - int(0.45 * SR))
        mix[t : t + len(c)] += c
        refs.append({"speaker": f"S{sid}", "text": text, "start_sample": t, "end_sample": t + len(c)})
        t += len(c) + int(rng.uniform(0.25, 0.8) * SR)
    mix = mix[: t + SR]
    speech_level = rms(np.concatenate([mix[r["start_sample"] : r["end_sample"]] for r in refs]))
    if snr is not None:
        noise = pink(len(mix)) * 0.5
        if babble:
            b = np.resize(babble_bed, len(mix))
            noise = noise + b / rms(b)
        if hum:
            tt = np.arange(len(mix)) / SR
            noise = noise + 0.6 * (np.sin(2 * np.pi * 60 * tt) + 0.5 * np.sin(2 * np.pi * 120 * tt))
        noise = noise / rms(noise) * speech_level / (10 ** (snr / 20))
        mix = mix + noise.astype(np.float32)
    if phone:
        mix = bandpass_phone(mix)
    peak = np.max(np.abs(mix))
    mix = mix / peak * (1.4 if clip else 0.9)
    if clip:
        mix = np.clip(mix, -1, 1)
    for r in refs:
        r["start"] = r.pop("start_sample") / SR
        r["end"] = r.pop("end_sample") / SR
    return mix.astype(np.float32), refs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.path.expanduser("~/models"))
    ap.add_argument("--out", default="bench/trials")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    engine = tts(args.models)

    # Side chatter: other voices reading the chemistry lecture, staggered.
    chatter = []
    for i, (sid, text) in enumerate(CHEM * 2):
        chatter.append(say(engine, [0, 3, 4, 2][i % 4], text, speed=1.1))
    streams = []
    for k in range(3):
        s = np.concatenate(chatter[k::3])
        streams.append(np.roll(s, k * SR * 3))
    n = min(len(s) for s in streams)
    babble_bed = sum(s[:n] for s in streams)

    for name, script in (("apes", APES), ("chem", CHEM)):
        clips = [say(engine, sid, text) for sid, text in script]
        for tier in TIERS:
            audio, refs = render(script, clips, tier, babble_bed)
            stem = f"{name}_{tier}"
            sf.write(f"{args.out}/{stem}.wav", audio, SR)
            with open(f"{args.out}/{stem}.json", "w") as f:
                json.dump({"segments": refs, "speakers": len({r['speaker'] for r in refs})}, f, indent=1)
            print(stem, f"{len(audio) / SR:.1f}s")


if __name__ == "__main__":
    main()
