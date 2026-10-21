# Accuracy bench

How Nevernote checks that it catches every word and every speaker, and how you can re-run it.

## The trials

**Synthetic lectures.** Two scripted classes:
- `apes`: AP Environmental Science, 6 speakers.
- `chem`: Chemistry, 4 speakers.

Each is voiced by distinct speakers with Kokoro TTS (`generate.py`), then rendered five times, each harder than the last:

| Tier | Room echo (RT60) | Students vs teacher | Noise (SNR) | Extras |
|---|---|---|---|---|
| Quiet room (`t0_clean`) | none | same level | none | none |
| Echoey room (`t1_room`) | 0.45 s | −8 dB | 28 dB | none |
| Classroom noise (`t2_classroom`) | 0.7 s | −12 dB | 15 dB | chatter, HVAC hum, 5% crosstalk |
| Loud room (`t3_noisy`) | 0.9 s | −16 dB | 8 dB | chatter, hum, 15% crosstalk |
| Brutal (`t4_brutal`) | 1.1 s | −20 dB | 3 dB | 25% crosstalk, phone-band audio, clipping |

The scripts are full of what students need: due dates ("Friday October 24th by 11:59 p.m."), test announcements, numbers, chemistry terms and names.

**Real speech.** Real recordings, not synthetic:
- LibriSpeech clips, including one downsampled to 8 kHz.
- The JFK inaugural sample.

## Scoring

- **Word error rate (WER):**
  - Uses the Whisper English normalizer, so case, punctuation and number formats ("11:59" vs "11.59", "24th" vs "24") don't count.
  - Everything else does: a wrong word, a missing word or an invented one.
- **Speaker accuracy:** the share of reference speech time given to the right speaker, under the best one-to-one matching of found speakers to real ones (Hungarian algorithm).

## Results

All runs are on CPU and on-device, with nothing sent anywhere. Each engine is scored at its own best input-level setting: Parakeet without gain, and Whisper and Moonshine with gain up to 8×, which they need on quiet speech.

<!-- results:start -->
<!-- results:end -->

What the numbers say:

- **Parakeet is the right default.** It is the most accurate in every tier, and in classroom noise it makes roughly half the errors of the others.
- **"Brutal" is beyond every model here.** 3 dB SNR with a quarter of the class talking over each other is beyond what any of these models can transcribe. This tier is the target for the next round of work: beam search with course vocabulary, and a stronger denoiser.
- **Speaker labels need cleaner audio.** They are near-perfect in a quiet room. In a loud room about 7 of every 10 seconds go to the right voice. Renaming a speaker in the app fixes the label everywhere in that class.

## Compare against any app (including Wispr Flow)

Nevernote doesn't call Wispr Flow's or anyone else's API. To compare fairly:

1. Play a trial WAV into the other app.
2. Paste its transcript into a text file.
3. Score it against the same reference:

```sh
python3 bench/evaluate.py --score wispr_apes_t2.txt --ref bench/trials/apes_t2_classroom.json
SHOW_DIFF=1 python3 bench/evaluate.py --score wispr_apes_t2.txt --ref bench/trials/apes_t2_classroom.json   # word-by-word diff
```

## Re-running

You need Python 3.11+ and these packages:

```sh
pip install sherpa-onnx soundfile numpy scipy jiwer whisper-normalizer
```

Download the models into `~/models`. They come from the [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases): Parakeet TDT 0.6b v2 int8, Moonshine base, Whisper base.en, Silero VAD, GTCRN, pyannote segmentation 3.0, TitaNet small and Kokoro en v0.19.

Then:

```sh
python3 bench/generate.py --models ~/models --out bench/trials
# Real speech: drop any WAV with a same-named .txt transcript into bench/trials
# (we used LibriSpeech test-clean clips and the JFK sample from the sherpa-onnx test set).
python3 bench/evaluate.py --models ~/models --trials bench/trials --asr parakeet --out bench/results.json
AGC_MAX=8 python3 bench/evaluate.py --models ~/models --trials bench/trials --asr moonshine whisper-base.en --out bench/results_gain8.json
python3 bench/report.py parakeet=bench/results.json moonshine=bench/results_gain8.json whisper-base.en=bench/results_gain8.json
```

`pipeline.py` is the reference pipeline: VAD, Parakeet per chunk, word timestamps, short bubbles, then denoise and diarize after stop. The desktop and iPhone apps implement the same steps (`apps/desktop/src/engine.ts`, `apps/mobile/src/lib/recorder.ts`).

Your own recording:

```sh
python3 bench/evaluate.py --wav lecture.wav --ref lecture.txt
```
