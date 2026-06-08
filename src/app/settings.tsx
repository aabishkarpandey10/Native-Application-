import { useRef } from "react";
import { Linking, Switch, View, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import Constants from "expo-constants";
import { Moon, Sun } from "lucide-react-native";
import { ADMIN_UNLOCK_TAP_COUNT, FEATURES } from "../constants/features";
import { BackButton, Cell, GroupedList, ListRow, Page, SectionHeader, Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { AppLogo } from "../components/branding/AppLogo";
import { NetworkMapSettings } from "../components/settings/NetworkMapSettings";
import { MIN_TOUCH, ROW_ICON_SIZE, SPACING } from "../constants/design";
import { useAppConfig } from "../hooks/useAppConfig";
import { useRefreshAppConfigOnFocus } from "../hooks/useRefreshAppConfigOnFocus";
import { useColors } from "../hooks/useColors";
import { buildApiUrl } from "../services/apiClient";
import { useStore } from "../store/store";

const iconSlot: ViewStyle = {
  width: ROW_ICON_SIZE,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

export default function SettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/tools");
  const { data: appConfig } = useAppConfig();
  useRefreshAppConfigOnFocus();
  const { theme, setTheme, enableNotifications, setEnableNotifications } = useStore();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onVersionPress = () => {
    if (!FEATURES.admin) return;
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
    versionTapCount.current += 1;
    if (versionTapCount.current >= ADMIN_UNLOCK_TAP_COUNT) {
      versionTapCount.current = 0;
      router.push("/admin" as never);
      return;
    }
    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
    }, 2500);
  };

  const allowTheme = appConfig?.allowUserTheme !== false;
  const transportUrl = appConfig?.linkTransportNsw ?? "https://transportnsw.info";
  const openDataUrl = appConfig?.linkOpenData ?? "https://opendata.transport.nsw.gov.au/";
  const notifHelp =
    appConfig?.notificationsHelpText ??
    "When enabled, Sydney Transit requests notification permission and alerts you about new major service disruptions.";
  const disclaimer =
    appConfig?.aboutDisclaimer ??
    "Sydney Transit uses Transport for NSW open data. Timetable accuracy is not guaranteed. Always check platform screens before boarding.";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Settings" left={<BackButton variant="plain" onPress={goBack} />} />

      <Page>
        {allowTheme ? (
          <>
            <SectionHeader title="Appearance" />
            <GroupedList>
              <Cell minHeight={MIN_TOUCH}>
                <View style={iconSlot}>
                  {theme === "dark" ? (
                    <Moon size={20} color={c.primary} strokeWidth={2} />
                  ) : (
                    <Sun size={20} color={c.primary} strokeWidth={2} />
                  )}
                </View>
                <Txt size={16} color={c.text} style={{ flex: 1, minWidth: 0, marginLeft: SPACING.iconGap }}>
                  Dark mode
                </Txt>
                <Switch
                  value={theme === "dark"}
                  onValueChange={(v) => setTheme(v ? "dark" : "light")}
                  trackColor={{ false: c.separator, true: c.primary }}
                  style={{ flexShrink: 0 }}
                />
              </Cell>
            </GroupedList>
          </>
        ) : (
          <Txt size={13} color={c.textSecondary} style={{ paddingHorizontal: SPACING.screen, paddingBottom: 12 }}>
            Theme is managed by your operator (current: {appConfig?.defaultTheme ?? "dark"}).
          </Txt>
        )}

        <SectionHeader title="Notifications" />
        <GroupedList>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1, minWidth: 0 }}>
              Service alerts
            </Txt>
            <Switch
              value={enableNotifications}
              onValueChange={setEnableNotifications}
              trackColor={{ false: c.separator, true: c.primary }}
              style={{ flexShrink: 0 }}
            />
          </Cell>
        </GroupedList>
        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, paddingTop: 6, lineHeight: 18 }}
        >
          {notifHelp}
        </Txt>

        <NetworkMapSettings />

        <SectionHeader title="About" />
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 16 }}>
          <AppLogo size={64} config={appConfig} />
          <Txt size={17} weight="600" color={c.text} style={{ marginTop: 10 }}>
            {appConfig?.appName ?? "Sydney Transit"}
          </Txt>
        </View>
        <GroupedList>
          <ListRow
            label="Admin panel"
            value="Web"
            onPress={() => Linking.openURL(buildApiUrl("/admin"))}
          />
          <ListRow
            label="Version"
            value={version}
            showChevron={false}
            onPress={FEATURES.admin ? onVersionPress : undefined}
          />
          <ListRow label="Transport for NSW" onPress={() => Linking.openURL(transportUrl)} />
          <ListRow label="Open data & API" onPress={() => Linking.openURL(openDataUrl)} />
        </GroupedList>

        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, paddingTop: 24, paddingBottom: 20, lineHeight: 20 }}
        >
          {disclaimer}
        </Txt>
      </Page>
    </View>
  );
}
