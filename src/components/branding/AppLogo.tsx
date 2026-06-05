import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";
import type { AppConfig } from "../../types/appConfig";
import { useAppConfig } from "../../hooks/useAppConfig";
import { resolveAppLogoImageSource } from "../../utils/appLogoUri";

type AppLogoProps = {
  size?: number;
  config?: AppConfig | null;
  style?: ViewStyle;
};

/** Operator logo from admin upload/URL, or bundled default. */
export function AppLogo({ size = 72, config: configProp, style }: AppLogoProps) {
  const { data: fetchedConfig } = useAppConfig();
  const config = configProp ?? fetchedConfig;
  const source = resolveAppLogoImageSource(config);
  const cacheKey =
    config?.appLogoUpdatedAt ??
    config?.appLogoUrl ??
    (config?.appLogoHasUpload ? "upload" : "default");
  const radius = Math.round(size * 0.22);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: "#0079C1",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Image
        key={cacheKey}
        source={source}
        style={{ width: size * 0.82, height: size * 0.82 }}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    </View>
  );
}
