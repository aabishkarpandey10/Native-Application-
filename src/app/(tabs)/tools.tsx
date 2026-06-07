import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Cloud,
  Clock,
  Map,
  MapPin,
  Settings,
} from "lucide-react-native";
import { Cell, GroupedList, Page, Txt } from "../../components/design";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { MIN_TOUCH, RADIUS, SPACING } from "../../constants/design";
import { useAppFeatures } from "../../hooks/useAppFeatures";
import { useColors } from "../../hooks/useColors";
import { useStore } from "../../store/store";
import { watchSettingsToolsValue } from "../../utils/watchSettingsLabel";

function ToolRow({
  icon,
  label,
  onPress,
  value,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const c = useColors();
  return (
    <Cell onPress={onPress} minHeight={MIN_TOUCH}>
      {icon}
      <Txt size={17} color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap, minWidth: 0 }}>
        {label}
      </Txt>
      {value ? (
        <Txt size={16} color={c.textSecondary} style={{ marginRight: 4, flexShrink: 0 }}>
          {value}
        </Txt>
      ) : null}
      <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
    </Cell>
  );
}

export default function ToolsScreen() {
  const c = useColors();
  const router = useRouter();
  const { alerts: showAlerts, maps: showMaps } = useAppFeatures();
  const watchSettings = useStore((s) => s.watchSettings);
  const favorites = useStore((s) => s.favorites);
  const watchValue = watchSettingsToolsValue(watchSettings, favorites);
  const iconColor = c.primary;
  const openNetworkMap = () =>
    router.push({ pathname: "/map", params: { mode: "view" } } as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Tools" />
      <Page tabScreen contentStyle={{ paddingTop: 8 }}>
        <View
          style={{
            marginHorizontal: SPACING.screen,
            marginBottom: 12,
            borderRadius: RADIUS.card,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.separator,
            paddingHorizontal: SPACING.screen,
            paddingVertical: 14,
          }}
        >
          <Txt size={18} weight="700" color={c.text}>
            Quick actions
          </Txt>
          <Txt size={13} color={c.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
            Open maps, service updates, and settings from one place.
          </Txt>
        </View>

        <GroupedList>
          <ToolRow
            icon={<MapPin size={22} color={iconColor} strokeWidth={2} />}
            label="Region"
            value="Sydney"
            onPress={() => {}}
          />
          {showAlerts ? (
            <ToolRow
              icon={<AlertTriangle size={22} color={iconColor} strokeWidth={2} />}
              label="Service Information"
              onPress={() => router.navigate("/(tabs)/alerts" as never)}
            />
          ) : null}
          {showMaps ? (
            <ToolRow
              icon={<Map size={22} color={iconColor} strokeWidth={2} />}
              label="Network map"
              onPress={openNetworkMap}
            />
          ) : null}
          <ToolRow
            icon={<Bell size={22} color={iconColor} strokeWidth={2} />}
            label="Alarm"
            onPress={() => router.push("/alarms" as never)}
          />
          <ToolRow
            icon={<Cloud size={22} color={iconColor} strokeWidth={2} />}
            label="Sync"
            onPress={() => router.navigate("/(tabs)/nearby" as never)}
          />
          <ToolRow
            icon={<Settings size={22} color={iconColor} strokeWidth={2} />}
            label="Settings"
            onPress={() => router.push("/settings" as never)}
          />
          <ToolRow
            icon={<Clock size={22} color={iconColor} strokeWidth={2} />}
            label="Watch Settings"
            value={watchValue}
            onPress={() => router.push("/watch-settings" as never)}
          />
        </GroupedList>

        <View style={{ paddingHorizontal: SPACING.screen, paddingTop: 20 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/nearby" as never)}
            accessibilityRole="button"
            accessibilityLabel="Nearby stops and departures"
            style={{
              borderRadius: RADIUS.button,
              minHeight: MIN_TOUCH,
              backgroundColor: c.muted,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: c.separator,
            }}
          >
            <Txt size={15} color={c.primary} weight="600">
              Nearby stops & departures →
            </Txt>
          </Pressable>
        </View>
      </Page>
    </View>
  );
}
