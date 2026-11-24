// Metro (the bundler) settings. Only the browser preview (npm run web) needs these; phone builds are unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The on-device database runs in the browser as a WebAssembly file.
config.resolver.assetExts.push('wasm');

// Native-only views (maps, Lottie) have .web.tsx stand-ins next to them, picked automatically.

module.exports = config;
