import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { MIN_TOUCH, TAB_BAR_HEIGHT } from "../../constants/design";
import { useAppConfig } from "../../hooks/useAppConfig";
import { useColors } from "../../hooks/useColors";
import { useStore } from "../../store/store";
import { watchSettingsToolsValue } from "../../utils/watchSettingsLabel";

function ToolRow({
  icon,
  label,
  onPress,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  value?: string;
}) {
  const c = useColors();
  return (
    <Cell onPress={onPress} minHeight={MIN_TOUCH}>
      {icon}
      <Txt size={17} color={c.text} style={{ flex: 1, marginLeft: 14 }}>
        {label}
      </Txt>
      {value ? (
        <Txt size={16} color={c.textSecondary} style={{ marginRight: 4 }}>
          {value}
        </Txt>
      ) : null}
      <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
    </Cell>
  );
}

export default function ToolsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: appConfig } = useAppConfig();
  const watchSettings = useStore((s) => s.watchSettings);
  const favorites = useStore((s) => s.favorites);
  const watchValue = watchSettingsToolsValue(watchSettings, favorites);
  const iconColor = c.primary;
  const showAlerts = appConfig?.featureAlerts !== false;
  const openNetworkMap = () =>
    router.push({ pathname: "/map", params: { mode: "view" } } as never);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Tools" />
      <Page bottomPad={TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 28} contentStyle={{ paddingTop: 8 }}>
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 12,
            borderRadius: 14,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.separator,
            paddingHorizontal: 16,
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
        <GroupedList inset={16}>
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
          <ToolRow
            icon={<Map size={22} color={iconColor} strokeWidth={2} />}
            label="Network map"
            onPress={openNetworkMap}
          />
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

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/nearby" as never)}
            style={{
              borderRadius: 10,
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
