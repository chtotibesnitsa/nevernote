import ExpoModulesCore

struct DiarizeOptions: Record {
  @Field var wavPath: String = ""
  @Field var segmentationModel: String = ""
  @Field var embeddingModel: String = ""
  @Field var denoiseModel: String = ""
  @Field var threshold: Double = 0.6
  @Field var numSpeakers: Int = -1
}

public class NevernoteSpeakersModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NevernoteSpeakers")

    // Runs off the JS thread; a 50-minute class takes well under a minute on a recent iPhone.
    AsyncFunction("diarize") { (o: DiarizeOptions, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let turns = try NNDiarizer.diarizeWav(
            o.wavPath,
            segmentationModel: o.segmentationModel,
            embeddingModel: o.embeddingModel,
            denoiseModel: o.denoiseModel,
            threshold: Float(o.threshold),
            numSpeakers: Int32(o.numSpeakers)
          )
          promise.resolve(turns)
        } catch {
          promise.reject("ERR_DIARIZE", error.localizedDescription)
        }
      }
    }
  }
}
