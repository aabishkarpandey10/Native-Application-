import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SydneyRailSchematicImage } from "../components/map/SydneyRailSchematicImage";
import { BackButton, Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { SPACING } from "../constants/design";
import { FeatureGate } from "../components/FeatureGate";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useColors } from "../hooks/useColors";
import { useSafeBack } from "../hooks/useSafeBack";

export default function MapScreen() {
  const { maps } = useAppFeatures();
  const c = useColors();
  const goBack = useSafeBack("/(tabs)/tools");

  const params = useLocalSearchParams<{ pick?: string; mode?: string }>();
  const pickRole = params.pick === "to" ? "to" : params.pick === "from" ? "from" : null;
  const viewOnly = params.mode === "view" || !pickRole;

  const headerTitle = pickRole === "from" ? "From Station" : pickRole === "to" ? "To Station" : "Network map";

  return (
    <FeatureGate enabled={maps} title="Maps unavailable" message="Network maps are turned off in admin settings.">
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title={headerTitle}
        left={<BackButton variant="plain" onPress={goBack} />}
      />

      {pickRole ? (
        <View style={{ paddingHorizontal: SPACING.screen, paddingBottom: 8 }}>
          <Txt size={14} color={c.textSecondary} style={{ lineHeight: 20 }}>
            Reference map only. Use By Name or By Distance in the station picker to choose your{" "}
            {pickRole === "from" ? "origin" : "destination"}.
          </Txt>
        </View>
      ) : viewOnly ? (
        <View style={{ paddingHorizontal: SPACING.screen, paddingBottom: 8 }}>
          <Txt size={14} color={c.textSecondary} style={{ lineHeight: 20 }}>
            View only — pinch to zoom and scroll. The map image is updated by your operator.
          </Txt>
        </View>
      ) : null}

      <SydneyRailSchematicImage />
    </View>
    </FeatureGate>
  );
}
