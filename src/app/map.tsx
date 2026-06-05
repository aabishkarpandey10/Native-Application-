import { Pressable, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { SydneyRailSchematicImage } from "../components/map/SydneyRailSchematicImage";
import { Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { MIN_TOUCH } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useSafeBack } from "../hooks/useSafeBack";

export default function MapScreen() {
  const c = useColors();
  const goBack = useSafeBack("/(tabs)/tools");

  const params = useLocalSearchParams<{ pick?: string; mode?: string }>();
  const pickRole = params.pick === "to" ? "to" : params.pick === "from" ? "from" : null;
  const viewOnly = params.mode === "view" || !pickRole;

  const headerTitle = pickRole === "from" ? "From Station" : pickRole === "to" ? "To Station" : "Network map";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title={headerTitle}
        left={
          <Pressable
            onPress={goBack}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: "center" }}
          >
            <ChevronLeft size={26} color={c.text} strokeWidth={2.2} />
          </Pressable>
        }
      />

      {pickRole ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Txt size={14} color={c.textSecondary} style={{ lineHeight: 20 }}>
            Reference map only. Use By Name or By Distance in the station picker to choose your{" "}
            {pickRole === "from" ? "origin" : "destination"}.
          </Txt>
        </View>
      ) : viewOnly ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Txt size={14} color={c.textSecondary} style={{ lineHeight: 20 }}>
            View only — pinch to zoom and scroll. The map image is updated by your operator in the
            admin panel.
          </Txt>
        </View>
      ) : null}

      <SydneyRailSchematicImage />
    </View>
  );
}
