// The app lives in a monorepo but outside the npm workspaces (React Native
// wants its own node_modules), so Metro is pointed at the shared core package.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, "packages/core")];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules")];
module.exports = config;
