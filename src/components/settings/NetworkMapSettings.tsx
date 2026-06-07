import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { Map } from "lucide-react-native";
import { GroupedList, ListRow, SectionHeader, Txt } from "../design";
import { SPACING } from "../../constants/design";
import { useAppConfig } from "../../hooks/useAppConfig";
import { useColors } from "../../hooks/useColors";
import {
  networkMapSourceLabel,
  resolveNetworkMapImageSource,
} from "../../utils/networkMapUri";

/** Settings: preview and open the map viewer. Upload and edits are in Admin → Map. */
export function NetworkMapSettings() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: config } = useAppConfig();

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["appConfig"] });
    }, [queryClient])
  );

  if (config?.featureMaps === false) return null;

  const mapBlurb =
    config?.settingsMapDescription ??
    "Sydney Metropolitan Rail System schematic. Pinch to zoom on supported devices.";

  const previewSource = resolveNetworkMapImageSource(config ?? null);
  const sourceLabel = networkMapSourceLabel(config ?? null);
  const hasCustomMap =
    Boolean(config?.networkMapUrl?.trim()) ||
    config?.networkMapHasUpload ||
    Boolean(config?.networkMapUpdatedAt);

  const openMap = () =>
    router.push({ pathname: "/map", params: { mode: "view" } } as never);

  return (
    <>
      <SectionHeader title="Maps" />
      <Txt
        size={12}
        color={c.textSecondary}
        style={{
          paddingHorizontal: SPACING.screen,
          paddingBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: "600",
        }}
      >
        {hasCustomMap ? `Current map · ${sourceLabel}` : "View only"}
      </Txt>

      <Pressable
        onPress={openMap}
        accessibilityRole="button"
        accessibilityLabel="Open network map full screen"
        style={{
          marginHorizontal: SPACING.screen,
          marginBottom: 12,
          height: 200,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "#0a1622",
          borderWidth: 1,
          borderColor: c.separator,
        }}
      >
        <Image
          source={previewSource}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          cachePolicy="none"
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <Txt size={13} color="#fff" weight="600">
            Tap to open full screen
          </Txt>
        </View>
      </Pressable>

      <GroupedList>
        <ListRow
          label="View network map"
          icon={<Map size={20} color={c.primary} strokeWidth={2} />}
          onPress={openMap}
        />
      </GroupedList>
      <Txt
        size={13}
        color={c.textSecondary}
        style={{ paddingHorizontal: SPACING.screen, paddingTop: 6, lineHeight: 18 }}
      >
        {mapBlurb}
      </Txt>
      {config?.networkMapUpdatedAt ? (
        <Txt
          size={12}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, paddingTop: 4, lineHeight: 17 }}
        >
          Map updated {new Date(config.networkMapUpdatedAt).toLocaleString()}.
        </Txt>
      ) : null}
      <Txt
        size={12}
        color={c.textSecondary}
        style={{ paddingHorizontal: SPACING.screen, paddingTop: 4, lineHeight: 17 }}
      >
        To change the map image, use Admin → Map (not available here).
      </Txt>
    </>
  );
}
