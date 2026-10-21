# Nevernote

**Every word in the room, on your phone. Free and open source.**

Put your phone (or laptop) on the desk. Nevernote:

- writes down everything said in class, offline;
- tells the voices apart;
- pings you the moment a due date or test is mentioned;
- turns the class into notes, a study guide and key terms.

Speech-to-text and speaker ID run **on your device**. No audio is uploaded to transcribe it.

> hmu, I made this → [@chtotibesnitsa](https://github.com/chtotibesnitsa)

## What's in this repo

| | |
|---|---|
| `apps/mobile` | iPhone app (Expo / React Native). Records with the screen locked, transcribes on-device, uses liquid glass on iOS 26. |
| `apps/desktop` | Mac and Windows app (Electron). Same engine, uses the laptop's CPU. |
| `apps/web` | Website, landing page and an in-browser version. Also the desktop app's UI. |
| `packages/core` | Shared logic: due-date and test detection, summaries, sync merge, plans, stats, transcript bubbles. |
| `server` | Optional Supabase backend: accounts, sync between phone and laptop, AI notes, Pro. |
| `bench` | The accuracy bench: increasingly hard classroom recordings, scored for words and speakers. |

## How it works

```
mic ──► speech chunks ──► Parakeet TDT 0.6b (on-device) ──► live bubbles + due-date alerts
                                                     │
                       on stop: denoise ─► pyannote + TitaNet speaker turns ─► "S1, S2…" labels
                                                     │
                     when online (optional): one cheap LLM call ─► notes · study guide · key terms
```

- **Live:**
  - Speech is cut at pauses (Silero VAD on desktop, an adaptive energy chunker on the phone).
  - Each chunk is transcribed by NVIDIA Parakeet through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). Words show up a second or two after each pause.
- **Due dates:**
  - A keyword-and-date parser (`packages/core/src/extract.ts`) understands phrases like "due Friday October 24th by 11:59 p.m.", "unit 3 test next Tuesday" and "this will be on the quiz".
  - It runs on every new line, so the notification fires during class. Reminders are scheduled for the evening before.
- **Speakers:**
  - After you stop, the whole recording is denoised (GTCRN) and diarized (pyannote segmentation 3.0 + TitaNet embeddings).
  - Every word gets the speaker talking at that instant. Tap a speaker to name them.
- **Offline first:**
  - Notes are saved on the device as you go. A three-dot strip shows each note's progress: heard → transcribed → summarized (red / orange / green).
  - Anything that needs the internet waits until you're back online.

## Accuracy

Word error rate on the bench (lower is better). See [bench/README.md](bench/README.md) for the trials and how to re-run them.

<!-- results:start -->
| Engine | Real speech | Quiet room | Echoey room | Classroom noise | Loud room | Brutal | Speed |
|---|---:|---:|---:|---:|---:|---:|---:|
| Nevernote · Parakeet | 2.0% | 4.2% | 3.7% | 12.8% | 24.1% | 89.9% | 3.0× real time |
| Moonshine base | 6.1% | 4.9% | 6.6% | 27.1% | 58.2% | 98.0% | 4.7× real time |
| Whisper base | 7.1% | 10.6% | 5.4% | 19.7% | 52.2% | 98.0% | 3.5× real time |

Speaker accuracy (share of speech time given to the right speaker):

| Quiet room | Echoey room | Classroom noise | Loud room | Brutal |
|---:|---:|---:|---:|---:|
| 95% | 80% | 83% | 71% | 61% |
<!-- results:end -->

## Free and Pro

**Free, forever:**
- recording and on-device transcription;
- speaker labels;
- due-date notifications and reminders;
- sync between your devices;
- AI notes and study guides: 3 instant per day, the rest overnight (or instantly after a 5-second sponsor card);
- insights and streaks.

**Pro ($3.99/month or $29.99/year):**
- due dates added to your calendar automatically;
- "Ask your notes" and "What did I miss?";
- instant notes every time;
- exam packs and export.

Pro prompts are rare by design: at most one every few days, never in the first two days, never while recording, and they stop for a month if you dismiss three.

## Run it

You need Node 22.

```sh
npm install
npm test                 # core logic tests
npm run dev:web          # website + browser app at http://localhost:5173
npm run dev:desktop      # desktop app (downloads the models on first record, ~530 MB)
```

iPhone app. It needs a Mac with Xcode for a local build, or EAS in the cloud:

```sh
cd apps/mobile
npm install --legacy-peer-deps
npx expo run:ios                 # simulator or a plugged-in iPhone
npx eas build -p ios --profile production && npx eas submit -p ios --latest
```

Everything works without a server; you just don't get sync or AI notes. To turn those on, follow [server/README.md](server/README.md) and fill in `apps/web/.env` and `apps/mobile/.env` (see the `.env.example` files).

Desktop releases: push a tag like `v1.0.0` and the **Desktop release** workflow builds the Mac (Apple Silicon and Intel) and Windows installers and attaches them to a GitHub release.

## Privacy

- Audio stays on your device. It is used to transcribe and label speakers, and then it's yours to keep or delete.
- If you sign in, transcripts sync to your own account so your phone and laptop match. When you ask for AI notes, the transcript text is sent to the summary model.
- Usage analytics are first-party (a table in our own database), only for signed-in users, and never include audio or transcript text.

## Models and licenses

The code is MIT licensed (see [LICENSE](LICENSE)). The models are downloaded on first use from the sherpa-onnx GitHub releases. They are not bundled, and each keeps its own license:

| Model | Use | License |
|---|---|---|
| NVIDIA Parakeet TDT 0.6b v2 (int8) | speech to text | CC-BY-4.0 |
| Moonshine base | lighter speech to text (desktop option) | MIT |
| Silero VAD | finding speech (desktop) | MIT |
| GTCRN | denoising before speaker ID | MIT |
| pyannote segmentation 3.0 | speaker turns | MIT |
| NVIDIA NeMo TitaNet small | speaker embeddings | CC-BY-4.0 |
| Kokoro v0.19 | voices for the synthetic bench only | Apache-2.0 |

Nevernote is an independent project. It is not affiliated with Wispr Flow or any other note taker, and uses none of their code, models or APIs.
