"""Reference implementation of the Nevernote transcription pipeline.

The desktop app (apps/desktop/src/main/engine.ts) runs the same steps with
sherpa-onnx-node, so numbers measured here describe what users get:

  audio -> [optional denoise] -> Silero VAD -> offline ASR per speech chunk
        -> pyannote segmentation + speaker embeddings -> clustering
        -> each ASR chunk gets the speaker with the most overlap
"""

import os
import time

import numpy as np
import sherpa_onnx

SR = 16000


def recognizer(models, name, threads=4, hotwords=None):
    m = models
    if name == "parakeet":
        d = f"{m}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
        kw = {}
        if hotwords:
            kw = dict(decoding_method="modified_beam_search", hotwords_file=hotwords, hotwords_score=2.0)
        return sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=f"{d}/encoder.int8.onnx", decoder=f"{d}/decoder.int8.onnx", joiner=f"{d}/joiner.int8.onnx",
            tokens=f"{d}/tokens.txt", num_threads=threads, model_type="nemo_transducer", **kw)
    if name.startswith("whisper"):
        size = name.split("-", 1)[1]
        d = f"{m}/sherpa-onnx-whisper-{size}"
        return sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=f"{d}/{size}-encoder.int8.onnx", decoder=f"{d}/{size}-decoder.int8.onnx",
            tokens=f"{d}/{size}-tokens.txt", num_threads=threads)
    if name == "moonshine":
        d = f"{m}/sherpa-onnx-moonshine-base-en-int8"
        return sherpa_onnx.OfflineRecognizer.from_moonshine(
            preprocessor=f"{d}/preprocess.onnx", encoder=f"{d}/encode.int8.onnx",
            uncached_decoder=f"{d}/uncached_decode.int8.onnx", cached_decoder=f"{d}/cached_decode.int8.onnx",
            tokens=f"{d}/tokens.txt", num_threads=threads)
    raise ValueError(name)


def denoiser(models):
    cfg = sherpa_onnx.OfflineSpeechDenoiserConfig(
        model=sherpa_onnx.OfflineSpeechDenoiserModelConfig(
            gtcrn=sherpa_onnx.OfflineSpeechDenoiserGtcrnModelConfig(model=f"{models}/gtcrn_simple.onnx"),
            num_threads=4))
    return sherpa_onnx.OfflineSpeechDenoiser(cfg)


def vad_chunks(models, samples, max_speech=20.0, threshold=0.35):
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = f"{models}/silero_vad.onnx"
    cfg.silero_vad.threshold = threshold
    cfg.silero_vad.min_silence_duration = 0.35
    cfg.silero_vad.min_speech_duration = 0.2
    cfg.silero_vad.max_speech_duration = max_speech
    cfg.sample_rate = SR
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=120)
    win = cfg.silero_vad.window_size
    out = []
    for i in range(0, len(samples), win):
        vad.accept_waveform(samples[i : i + win])
        while not vad.empty():
            out.append((vad.front.start, np.array(vad.front.samples, dtype=np.float32)))
            vad.pop()
    vad.flush()
    while not vad.empty():
        out.append((vad.front.start, np.array(vad.front.samples, dtype=np.float32)))
        vad.pop()
    return out


def diarizer(models, embedding="titanet", threshold=0.6, num_speakers=-1):
    emb = {
        "titanet": f"{models}/nemo_en_titanet_small.onnx",
        "eres2net": f"{models}/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx",
    }[embedding]
    cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=f"{models}/sherpa-onnx-pyannote-segmentation-3-0/model.int8.onnx"),
            num_threads=4),
        embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=emb, num_threads=4),
        clustering=sherpa_onnx.FastClusteringConfig(num_clusters=num_speakers, threshold=threshold),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    return sherpa_onnx.OfflineSpeakerDiarization(cfg)


def fixed_chunks(samples, win=15.0):
    n = int(win * SR)
    return [(i, samples[i : i + n]) for i in range(0, len(samples), n)]


def with_gaps(chunks, n, samples, min_gap=0.6):
    """Quiet, far-away voices (a student in the back row) are what VAD misses
    first. Transcribe the gaps between detected speech too: Parakeet stays
    silent on pure noise, so this recovers dropped turns without inventing text."""
    out, pos = [], 0
    for st, c in chunks:
        if st - pos >= min_gap * SR:
            out.append((pos, samples[pos:st]))
        out.append((st, c))
        pos = st + len(c)
    if n - pos >= min_gap * SR:
        out.append((pos, samples[pos:n]))
    # Long gaps get split so no single decode exceeds ~20 s.
    final = []
    for st, c in out:
        for k in range(0, len(c), 20 * SR):
            final.append((st + k, c[k : k + 20 * SR]))
    return final


def transcribe(models, samples, asr="parakeet", denoise=False, diarize=True, rec=None, diar=None,
               vad_threshold=0.35, asr_on="raw", chunker="vad", rescue_gaps=False, **dkw):
    """denoise: run GTCRN first. asr_on: 'raw' feeds the recognizer the original
    audio cut where the (possibly denoised) VAD found speech; 'clean' feeds it
    the denoised audio."""
    t0 = time.time()
    raw = samples
    if denoise:
        d = denoiser(models).run(samples, SR)
        samples = np.array(d.samples, dtype=np.float32)[: len(raw)]
    rec = rec or recognizer(models, asr)
    chunks = vad_chunks(models, samples, threshold=vad_threshold) if chunker == "vad" else fixed_chunks(samples)
    # A VAD that hears almost nothing in a long recording is being fooled by
    # noise, not listening to silence: fall back to fixed windows.
    voiced = sum(len(c) for _, c in chunks)
    if len(samples) > 30 * SR and voiced < 0.15 * len(samples):
        chunks = fixed_chunks(samples)
    if rescue_gaps:
        chunks = with_gaps(chunks, len(samples), samples)
    if asr_on == "raw" and denoise:
        chunks = [(st, raw[st : st + len(c)]) for st, c in chunks]
    streams = []
    for _, c in chunks:
        # Far-away students arrive 15-20 dB quieter than the teacher; level
        # every chunk so the recognizer hears them at the same loudness.
        c = c * min(0.1 / (np.sqrt(np.mean(c**2)) + 1e-6), 30.0)
        c = np.clip(c, -1, 1).astype(np.float32)
        s = rec.create_stream()
        s.accept_waveform(SR, c)
        streams.append(s)
    rec.decode_streams(streams)
    segs = [
        {"start": st / SR, "end": (st + len(c)) / SR, "text": s.result.text.strip()}
        for (st, c), s in zip(chunks, streams)
    ]
    segs = [s for s in segs if s["text"]]
    t_asr = time.time() - t0
    if diarize:
        diar = diar or diarizer(models, **dkw)
        turns = diar.process(samples).sort_by_start_time()
        for s in segs:
            best, score = "S?", 0.0
            for t in turns:
                ov = min(s["end"], t.end) - max(s["start"], t.start)
                if ov > score:
                    best, score = f"spk{t.speaker}", ov
            s["speaker"] = best
    return segs, {"asr_seconds": t_asr, "total_seconds": time.time() - t0, "audio_seconds": len(samples) / SR}
