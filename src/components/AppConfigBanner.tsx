import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Info } from "lucide-react-native";
import { SPACING } from "../constants/design";
import { Txt } from "./design";
import { useAppConfig } from "../hooks/useAppConfig";
import { useColors } from "../hooks/useColors";

/** Shows admin-configured announcement and maintenance notice on main tabs. */
export function AppConfigBanner() {
  const c = useColors();
  const router = useRouter();
  const { data: config } = useAppConfig();

  if (!config) return null;

  if (config.maintenanceMode) {
    return (
      <View
        style={{
          backgroundColor: "#B45309",
          paddingHorizontal: SPACING.screen,
          paddingVertical: 10,
        }}
      >
        <Txt size={14} weight="600" color="#fff">
          {config.maintenanceMessage?.trim() ||
            "Maintenance mode — some live data may be unavailable"}
        </Txt>
      </View>
    );
  }

  if (!config.showAnnouncementBanner || !config.announcement?.trim()) {
    return null;
  }

  const bannerColor = /^#[0-9A-Fa-f]{6}$/.test(config.accentColor) ? config.accentColor : c.primary;

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/about")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: bannerColor,
        paddingHorizontal: SPACING.screen,
        paddingVertical: 10,
      }}
    >
      <Info size={18} color="#fff" strokeWidth={2.2} />
      <Txt size={14} color="#fff" style={{ flex: 1 }}>
        {config.announcement.trim()}
      </Txt>
    </Pressable>
  );
}
