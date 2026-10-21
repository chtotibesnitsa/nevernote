#include "nn_diarize.h"

#include <algorithm>
#include <cstring>

#include "sherpa-onnx/c-api/c-api.h"

namespace nn {

bool Diarize(const std::string &wavPath, const std::string &segmentationModel, const std::string &embeddingModel,
             const std::string &denoiseModel, float threshold, int numSpeakers, std::vector<Turn> *turns,
             std::string *error) {
  const SherpaOnnxWave *wave = SherpaOnnxReadWave(wavPath.c_str());
  if (!wave) {
    *error = "Could not read the recording";
    return false;
  }
  std::vector<float> samples(wave->samples, wave->samples + wave->num_samples);
  int32_t sampleRate = wave->sample_rate;
  SherpaOnnxFreeWave(wave);

  // Denoise first: in a noisy room it keeps the hum from becoming a "speaker".
  if (!denoiseModel.empty()) {
    SherpaOnnxOfflineSpeechDenoiserConfig dc;
    std::memset(&dc, 0, sizeof(dc));
    dc.model.gtcrn.model = denoiseModel.c_str();
    dc.model.num_threads = 2;
    dc.model.provider = "cpu";
    const SherpaOnnxOfflineSpeechDenoiser *dn = SherpaOnnxCreateOfflineSpeechDenoiser(&dc);
    if (dn) {
      const SherpaOnnxDenoisedAudio *out =
          SherpaOnnxOfflineSpeechDenoiserRun(dn, samples.data(), (int32_t)samples.size(), sampleRate);
      if (out) {
        size_t n = std::min((size_t)out->n, samples.size());
        std::memcpy(samples.data(), out->samples, n * sizeof(float));
        SherpaOnnxDestroyDenoisedAudio(out);
      }
      SherpaOnnxDestroyOfflineSpeechDenoiser(dn);
    }
  }

  SherpaOnnxOfflineSpeakerDiarizationConfig c;
  std::memset(&c, 0, sizeof(c));
  c.segmentation.pyannote.model = segmentationModel.c_str();
  c.segmentation.num_threads = 2;
  c.segmentation.provider = "cpu";
  c.embedding.model = embeddingModel.c_str();
  c.embedding.num_threads = 2;
  c.embedding.provider = "cpu";
  c.clustering.num_clusters = numSpeakers;
  c.clustering.threshold = threshold;
  c.min_duration_on = 0.3f;
  c.min_duration_off = 0.5f;

  const SherpaOnnxOfflineSpeakerDiarization *sd = SherpaOnnxCreateOfflineSpeakerDiarization(&c);
  if (!sd) {
    *error = "Speaker models failed to load";
    return false;
  }
  if (SherpaOnnxOfflineSpeakerDiarizationGetSampleRate(sd) != sampleRate) {
    SherpaOnnxDestroyOfflineSpeakerDiarization(sd);
    *error = "Recording must be 16 kHz";
    return false;
  }

  const SherpaOnnxOfflineSpeakerDiarizationResult *r =
      SherpaOnnxOfflineSpeakerDiarizationProcess(sd, samples.data(), (int32_t)samples.size());
  if (r) {
    int32_t n = SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments(r);
    const SherpaOnnxOfflineSpeakerDiarizationSegment *segs = SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime(r);
    for (int32_t i = 0; segs && i < n; i++) turns->push_back({segs[i].start, segs[i].end, segs[i].speaker});
    if (segs) SherpaOnnxOfflineSpeakerDiarizationDestroySegment(segs);
    SherpaOnnxOfflineSpeakerDiarizationDestroyResult(r);
  }
  SherpaOnnxDestroyOfflineSpeakerDiarization(sd);
  return true;
}

}  // namespace nn
