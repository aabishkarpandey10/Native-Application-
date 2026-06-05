module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // Zustand ESM uses import.meta — breaks web without this (SDK 54)
          unstable_transformImportMeta: true,
        },
      ],
      "nativewind/babel",
    ],
  };
};
