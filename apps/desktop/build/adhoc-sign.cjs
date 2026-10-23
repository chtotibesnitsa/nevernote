// Without an Apple Developer ID the Mac app ships unsigned, and Apple Silicon
// Macs call an unsigned (or half-signed) app "damaged". An ad-hoc signature
// makes it a normal unidentified-developer app that opens after one approval.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

exports.default = async function adhocSign({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== "darwin" || process.env.CSC_LINK) return;
  const app = join(appOutDir, `${packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
};
