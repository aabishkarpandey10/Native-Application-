import { Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Cell, GroupedList, Page, Txt } from "../../components/design";
import { AppLogo } from "../../components/branding/AppLogo";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { MIN_TOUCH, SPACING, TAB_BAR_HEIGHT } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { useAppConfig } from "../../hooks/useAppConfig";
import { useRefreshAppConfigOnFocus } from "../../hooks/useRefreshAppConfigOnFocus";

export default function AboutScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data: appConfig } = useAppConfig();
  useRefreshAppConfigOnFocus();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const appName = appConfig?.appName ?? "Sydney Transit";
  const tagline = appConfig?.tagline ?? "Saved trips, nearby stops & live departures";
  const transportUrl = appConfig?.linkTransportNsw ?? "https://transportnsw.info";
  const openDataUrl = appConfig?.linkOpenData ?? "https://opendata.transport.nsw.gov.au/";
  const disclaimer =
    appConfig?.aboutDisclaimer ??
    "Sydney Transit is an unofficial companion app using Transport for NSW open data. Not affiliated with TfNSW. Always check platform screens before boarding.";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="About" />
      <Page bottomPad={TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 28} contentStyle={{ paddingTop: 8 }}>
        <View style={{ alignItems: "center", paddingVertical: 32 }}>
          <AppLogo size={88} config={appConfig} />
          <Txt size={22} weight="700" color={c.text} style={{ marginTop: 16 }}>
            {appName}
          </Txt>
          <Txt
            size={14}
            color={c.textSecondary}
            style={{ marginTop: 4, textAlign: "center", paddingHorizontal: 24 }}
          >
            {tagline}
          </Txt>
          <Txt size={13} color={c.textSecondary} style={{ marginTop: 8 }}>
            Version {version}
          </Txt>
        </View>

        <GroupedList inset={16}>
          <Cell minHeight={MIN_TOUCH} onPress={() => Linking.openURL(transportUrl)}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Transport for NSW
            </Txt>
          </Cell>
          <Cell minHeight={MIN_TOUCH} onPress={() => Linking.openURL(openDataUrl)}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Open data & API
            </Txt>
          </Cell>
        </GroupedList>

        <Txt
          size={13}
          color={c.textSecondary}
          style={{
            paddingHorizontal: SPACING.screen + 4,
            paddingTop: 24,
            lineHeight: 20,
            textAlign: "center",
          }}
        >
          {disclaimer}
        </Txt>
      </Page>
    </View>
  );
}
