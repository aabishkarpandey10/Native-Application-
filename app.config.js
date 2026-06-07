/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  const appJson = require("./app.json");
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:3000";
  const isPrivateOrLocal =
    !apiUrl ||
    /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i.test(apiUrl);
  const allowCleartext = apiUrl.startsWith("http://");

  const buildProfile = process.env.EAS_BUILD_PROFILE || "";
  const strictStoreRelease = buildProfile === "production";

  if (process.env.EAS_BUILD === "true" && strictStoreRelease && isPrivateOrLocal) {
    throw new Error(
      "[EAS build] EXPO_PUBLIC_API_URL must be a public HTTPS URL reachable from cloud devices. " +
        `Current value: "${apiUrl}". ` +
        "Set it with: eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://YOUR-API-DOMAIN"
    );
  }

  if (process.env.EAS_BUILD === "true" && strictStoreRelease && allowCleartext) {
    throw new Error(
      "[EAS build] EXPO_PUBLIC_API_URL must use HTTPS for release Android builds. " +
        `Current value: "${apiUrl}".`
    );
  }

  const plugins = [...(appJson.expo.plugins || [])];
  if (!plugins.some((p) => (Array.isArray(p) ? p[0] : p) === "expo-build-properties")) {
    plugins.push([
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: allowCleartext,
        },
        ios: allowCleartext
          ? {
              infoPlist: {
                NSAppTransportSecurity: {
                  NSAllowsLocalNetworking: true,
                },
              },
            }
          : {},
      },
    ]);
  }

  return {
    ...appJson.expo,
    plugins,
    android: {
      ...appJson.expo.android,
      usesCleartextTraffic: allowCleartext,
    },
    extra: {
      ...appJson.expo.extra,
      apiUrl,
    },
  };
};
