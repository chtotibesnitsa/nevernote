#import "NNDiarizer.h"

#include "nn_diarize.h"

@implementation NNDiarizer

+ (NSArray<NSDictionary<NSString *, NSNumber *> *> *)diarizeWav:(NSString *)wavPath
                                             segmentationModel:(NSString *)segmentationModel
                                                embeddingModel:(NSString *)embeddingModel
                                                  denoiseModel:(NSString *)denoiseModel
                                                     threshold:(float)threshold
                                                   numSpeakers:(int)numSpeakers
                                                         error:(NSError **)error {
  std::vector<nn::Turn> turns;
  std::string message;
  if (!nn::Diarize(wavPath.UTF8String, segmentationModel.UTF8String, embeddingModel.UTF8String, denoiseModel.UTF8String,
                   threshold, numSpeakers, &turns, &message)) {
    if (error) {
      *error = [NSError errorWithDomain:@"NevernoteSpeakers"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : [NSString stringWithUTF8String:message.c_str()]}];
    }
    return nil;
  }
  NSMutableArray *out = [NSMutableArray arrayWithCapacity:turns.size()];
  for (const auto &t : turns) [out addObject:@{@"start" : @(t.start), @"end" : @(t.end), @"speaker" : @(t.speaker)}];
  return out;
}

@end
