const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Prevent expo-sqlite WASM from being bundled on web (we use db.web.ts + webStore)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && (moduleName === "expo-sqlite" || moduleName.startsWith("expo-sqlite/"))) {
    return { type: "empty" };
  }
  // Zustand ESM + import.meta crashes Metro web bundles — use CJS entry
  if (moduleName === "zustand" || moduleName.startsWith("zustand/")) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// forceWriteFileSystem avoids Metro crash on NativeWind Tailwind file-watch (addedFiles undefined)
module.exports = withNativeWind(config, {
  input: "./src/global.css",
  forceWriteFileSystem: true,
});
