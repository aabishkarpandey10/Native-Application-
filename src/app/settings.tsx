import { Linking, Pressable, Switch, View } from "react-native";
import { useSafeBack } from "../hooks/useSafeBack";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { ChevronRight, Moon, Sun } from "lucide-react-native";
import { Cell, GroupedList, NavBar, Page, SectionHeader, Txt } from "../components/design";
import { AppLogo } from "../components/branding/AppLogo";
import { NetworkMapSettings } from "../components/settings/NetworkMapSettings";
import { MIN_TOUCH, SPACING } from "../constants/design";
import { useAppConfig } from "../hooks/useAppConfig";
import { useRefreshAppConfigOnFocus } from "../hooks/useRefreshAppConfigOnFocus";
import { useColors } from "../hooks/useColors";
import { useStore } from "../store/store";

export default function SettingsScreen() {
  const c = useColors();
  const goBack = useSafeBack("/(tabs)/tools");
  const { data: appConfig } = useAppConfig();
  useRefreshAppConfigOnFocus();
  const { theme, setTheme, enableNotifications, setEnableNotifications } = useStore();
  const version = Constants.expoConfig?.version ?? "1.0.0";

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
      <StatusBar style={c.isDark ? "light" : "dark"} />
      <NavBar title="Settings" onBack={goBack} />

      <Page>
        {allowTheme ? (
          <>
            <SectionHeader title="Appearance" />
            <GroupedList inset={16}>
              <Cell minHeight={MIN_TOUCH}>
                {theme === "dark" ? (
                  <Moon size={20} color={c.primary} strokeWidth={2} />
                ) : (
                  <Sun size={20} color={c.primary} strokeWidth={2} />
                )}
                <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: 12 }}>
                  Dark mode
                </Txt>
                <Switch
                  value={theme === "dark"}
                  onValueChange={(v) => setTheme(v ? "dark" : "light")}
                  trackColor={{ false: c.separator, true: c.primary }}
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
        <GroupedList inset={16}>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Service alerts
            </Txt>
            <Switch
              value={enableNotifications}
              onValueChange={setEnableNotifications}
              trackColor={{ false: c.separator, true: c.primary }}
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
        <GroupedList inset={16}>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text}>Version</Txt>
            <Txt size={16} color={c.textSecondary}>
              {version}
            </Txt>
          </Cell>
          <Cell minHeight={MIN_TOUCH} onPress={() => Linking.openURL(transportUrl)}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Transport for NSW
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
          <Cell minHeight={MIN_TOUCH} onPress={() => Linking.openURL(openDataUrl)}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Open data & API
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
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
