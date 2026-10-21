// Plain C++ so it can be tested on any machine against sherpa-onnx's C API.
#pragma once

#include <string>
#include <vector>

namespace nn {

struct Turn {
  float start;
  float end;
  int speaker;
};

// Reads a 16 kHz WAV, optionally denoises it, and returns speaker turns.
// Returns false with `error` set when the audio or models can't be loaded.
bool Diarize(const std::string &wavPath, const std::string &segmentationModel, const std::string &embeddingModel,
             const std::string &denoiseModel, float threshold, int numSpeakers, std::vector<Turn> *turns,
             std::string *error);

}  // namespace nn
