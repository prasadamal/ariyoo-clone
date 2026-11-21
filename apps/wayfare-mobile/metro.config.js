// Metro (the bundler) settings. Only the browser preview (npm run web) needs these; phone builds are unaffected.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The on-device database runs in the browser as a WebAssembly file.
config.resolver.assetExts.push('wasm');

// In the browser only, the native map is replaced by a placeholder (see web-preview/).
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'web-preview', 'react-native-maps.js') };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
