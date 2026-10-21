#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Speaker turns for a whole recording, via sherpa-onnx's C API.
@interface NNDiarizer : NSObject

/// Returns [{start, end, speaker}] in seconds, or nil with `error` set.
+ (nullable NSArray<NSDictionary<NSString *, NSNumber *> *> *)diarizeWav:(NSString *)wavPath
                                                     segmentationModel:(NSString *)segmentationModel
                                                        embeddingModel:(NSString *)embeddingModel
                                                          denoiseModel:(NSString *)denoiseModel
                                                             threshold:(float)threshold
                                                           numSpeakers:(int)numSpeakers
                                                                 error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
