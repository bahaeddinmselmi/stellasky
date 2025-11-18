const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude .ico files from asset processing to avoid jimp errors
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'ico');

// Disable asset optimization entirely for export
config.transformer = {
  ...config.transformer,
  enableBabelRCLookup: false,
  assetPlugins: [],
};

module.exports = config;
