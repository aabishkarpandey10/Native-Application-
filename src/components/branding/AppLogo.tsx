import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";
import type { AppConfig } from "../../types/appConfig";
import { useAppConfig } from "../../hooks/useAppConfig";
import {
  BUNDLED_APP_LOGO,
  resolveAppLogoImageSource,
} from "../../utils/appLogoUri";

type AppLogoProps = {
  size?: number;
  config?: AppConfig | null;
  style?: ViewStyle;
};

/** Operator logo from admin upload/URL, or bundled default. */
export function AppLogo({ size = 72, config: configProp, style }: AppLogoProps) {
  const { data: fetchedConfig } = useAppConfig();
  const config = configProp ?? fetchedConfig;
  const resolvedSource = resolveAppLogoImageSource(config);
  const cacheKey =
    config?.appLogoUpdatedAt ??
    config?.appLogoUrl ??
    (config?.appLogoHasUpload ? "upload" : "default");
  const radius = Math.round(size * 0.22);
  const [source, setSource] = useState(resolvedSource);

  useEffect(() => {
    setSource(resolvedSource);
  }, [cacheKey, resolvedSource]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Image
        key={cacheKey}
        source={source}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityLabel="App logo"
        onError={() => setSource(BUNDLED_APP_LOGO)}
      />
    </View>
  );
}
