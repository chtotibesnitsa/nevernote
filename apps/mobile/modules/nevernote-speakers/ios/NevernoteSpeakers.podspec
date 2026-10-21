require "json"

# Headers for sherpa-onnx's C API come from the xcframework that
# react-native-sherpa-onnx downloads; the static library itself is already
# linked into the app by that pod.
sherpa_root = begin
  File.dirname(`node --print "require.resolve('react-native-sherpa-onnx/package.json')"`.strip)
rescue
  File.expand_path("../../../node_modules/react-native-sherpa-onnx", __dir__)
end
xcframework = File.join(sherpa_root, "ios", "Frameworks", "sherpa_onnx.xcframework")

Pod::Spec.new do |s|
  s.name           = "NevernoteSpeakers"
  s.version        = "1.0.0"
  s.summary        = "On-device speaker labels for Nevernote"
  s.homepage       = "https://github.com/chtotibesnitsa/nevernote"
  s.license        = "MIT"
  s.author         = "Nevernote"
  s.platforms      = { :ios => "15.1" }
  s.source         = { git: "" }
  s.static_framework = true

  s.dependency "ExpoModulesCore"
  s.dependency "SherpaOnnx"

  s.source_files = "**/*.{h,m,mm,cpp,swift}"
  s.public_header_files = "NNDiarizer.h"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "HEADER_SEARCH_PATHS[sdk=iphoneos*]" => "$(inherited) \"#{xcframework}/ios-arm64/Headers\"",
    "HEADER_SEARCH_PATHS[sdk=iphonesimulator*]" => "$(inherited) \"#{xcframework}/ios-arm64_x86_64-simulator/Headers\"",
  }
end
