import { Platform, Pressable, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Clock, MapPin, Smartphone, Watch } from "lucide-react-native";
import {
  BackButton,
  Cell,
  Chip,
  GroupedList,
  Page,
  SectionHeader,
  Txt,
} from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { MIN_TOUCH, SPACING } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useSafeBack } from "../hooks/useSafeBack";
import {
  useStore,
  type WatchComplication,
  type WatchRefreshMinutes,
  type WatchSettings,
} from "../store/store";
import { shortStationName } from "../utils/tripViewFormat";
import { watchComplicationLabel } from "../utils/watchSettingsLabel";

const COMPLICATION_OPTIONS: { id: WatchComplication; label: string; hint: string }[] = [
  {
    id: "next_departure",
    label: "Next departure",
    hint: "Countdown at a favourite stop you choose below.",
  },
  {
    id: "nearest",
    label: "Nearest stop",
    hint: "Uses your phone location to pick the closest stop.",
  },
  {
    id: "saved_trip",
    label: "Saved trip",
    hint: "Shows your first saved journey for a quick glance.",
  },
  {
    id: "trip_alarm",
    label: "Trip alarm",
    hint: "Next enabled trip alarm and wake-up time.",
  },
];

const REFRESH_OPTIONS: WatchRefreshMinutes[] = [1, 5, 15];

function watchPlatformHint(): string {
  if (Platform.OS === "ios") {
    return "Configure what your Apple Watch shows when the Sydney Transit watch app is installed. Settings are saved on this phone and will sync to your watch.";
  }
  if (Platform.OS === "android") {
    return "Configure Wear OS complications and tiles. Settings are saved on this phone and will sync when the watch companion is available.";
  }
  return "Watch face options are saved on your phone. Pair a device with the iOS or Android app to use them on your wrist.";
}

export default function WatchSettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/tools");

  const watchSettings = useStore((s) => s.watchSettings);
  const setWatchSettings = useStore((s) => s.setWatchSettings);
  const favorites = useStore((s) => s.favorites);
  const savedTrips = useStore((s) => s.savedTrips);
  const alarmTrips = useStore((s) => s.alarmTrips);
  const enableNotifications = useStore((s) => s.enableNotifications);

  const primaryStop = favorites.find((f) => f.station_id === watchSettings.primaryStopId);
  const activeAlarms = alarmTrips.filter((a) => a.enabled).length;

  const setComplication = (complication: WatchComplication) => {
    const patch: Partial<WatchSettings> = { complication };
    if (complication === "next_departure" && !watchSettings.primaryStopId && favorites[0]) {
      patch.primaryStopId = favorites[0].station_id;
    }
    setWatchSettings(patch);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Watch settings" left={<BackButton variant="plain" onPress={goBack} />} />

      <Page>
        <View
          style={{
            marginHorizontal: SPACING.screen,
            marginBottom: 8,
            padding: 14,
            borderRadius: 12,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.separator,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <Watch size={28} color={c.primary} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Txt size={15} weight="600" color={c.text}>
              Wrist glance
            </Txt>
            <Txt size={13} color={c.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
              {watchPlatformHint()}
            </Txt>
          </View>
        </View>

        <SectionHeader title="Sync" />
        <GroupedList>
          <Cell minHeight={MIN_TOUCH}>
            <Smartphone size={20} color={c.primary} strokeWidth={2} />
            <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap }}>
              Sync to watch
            </Txt>
            <Switch
              value={watchSettings.syncEnabled}
              onValueChange={(syncEnabled) => setWatchSettings({ syncEnabled })}
              trackColor={{ false: c.separator, true: c.primary }}
            />
          </Cell>
        </GroupedList>
        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, marginBottom: 12, lineHeight: 18 }}
        >
          When off, watch complications stay blank until you turn sync back on.
        </Txt>

        <SectionHeader title="Watch face" />
        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, marginBottom: 10, lineHeight: 18 }}
        >
          Choose what appears on your primary complication.
        </Txt>
        <View style={{ paddingHorizontal: SPACING.screen, gap: 8, marginBottom: 8 }}>
          {COMPLICATION_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setComplication(opt.id)}
              disabled={!watchSettings.syncEnabled}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: 10,
                backgroundColor:
                  watchSettings.complication === opt.id ? c.primary + "18" : c.card,
                borderWidth: 1,
                borderColor:
                  watchSettings.complication === opt.id ? c.primary : c.separator,
                opacity: !watchSettings.syncEnabled ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              <Txt
                size={16}
                weight={watchSettings.complication === opt.id ? "600" : "500"}
                color={watchSettings.complication === opt.id ? c.primary : c.text}
              >
                {opt.label}
              </Txt>
              <Txt size={13} color={c.textSecondary} style={{ marginTop: 4, lineHeight: 18 }}>
                {opt.hint}
              </Txt>
            </Pressable>
          ))}
        </View>

        {watchSettings.complication === "next_departure" ? (
          <>
            <SectionHeader title="Primary stop" />
            {favorites.length === 0 ? (
              <View
                style={{
                  marginHorizontal: SPACING.screen,
                  padding: SPACING.cell,
                  borderRadius: 10,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.separator,
                }}
              >
                <Txt size={14} color={c.textSecondary} style={{ lineHeight: 20 }}>
                  Add a favourite stop on the Favourites tab, then pick it here for your watch
                  face.
                </Txt>
                <Pressable
                  onPress={() => router.push("/(tabs)/favourites" as never)}
                  style={{ marginTop: 12 }}
                >
                  <Txt size={15} weight="600" color={c.primary}>
                    Open favourites →
                  </Txt>
                </Pressable>
              </View>
            ) : (
              <GroupedList>
                {favorites.map((fav) => (
                  <Cell
                    key={fav.station_id}
                    minHeight={MIN_TOUCH}
                    onPress={() =>
                      setWatchSettings({
                        primaryStopId: fav.station_id,
                      })
                    }
                  >
                    <MapPin
                      size={20}
                      color={
                        watchSettings.primaryStopId === fav.station_id
                          ? c.primary
                          : c.textSecondary
                      }
                      strokeWidth={2}
                    />
                    <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap }}>
                      {shortStationName(fav.station_name)}
                    </Txt>
                    {watchSettings.primaryStopId === fav.station_id ? (
                      <Txt size={14} weight="600" color={c.primary}>
                        Selected
                      </Txt>
                    ) : null}
                  </Cell>
                ))}
              </GroupedList>
            )}
          </>
        ) : null}

        <SectionHeader title="Refresh on watch" />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: SPACING.screen,
            marginBottom: 8,
          }}
        >
          {REFRESH_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={`Every ${m} min`}
              active={watchSettings.refreshMinutes === m}
              onPress={() => setWatchSettings({ refreshMinutes: m })}
            />
          ))}
        </View>
        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, marginBottom: 12, lineHeight: 18 }}
        >
          How often live departures update on the watch. Shorter intervals use more battery.
        </Txt>

        <SectionHeader title="What to sync" />
        <GroupedList>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Favourite stops
            </Txt>
            <Switch
              value={watchSettings.syncFavorites}
              onValueChange={(syncFavorites) => setWatchSettings({ syncFavorites })}
              trackColor={{ false: c.separator, true: c.primary }}
              disabled={!watchSettings.syncEnabled}
            />
          </Cell>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Saved trips
            </Txt>
            <Switch
              value={watchSettings.syncSavedTrips}
              onValueChange={(syncSavedTrips) => setWatchSettings({ syncSavedTrips })}
              trackColor={{ false: c.separator, true: c.primary }}
              disabled={!watchSettings.syncEnabled}
            />
          </Cell>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Trip alarms
            </Txt>
            <Switch
              value={watchSettings.syncTripAlarms}
              onValueChange={(syncTripAlarms) => setWatchSettings({ syncTripAlarms })}
              trackColor={{ false: c.separator, true: c.primary }}
              disabled={!watchSettings.syncEnabled}
            />
          </Cell>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Service alerts
            </Txt>
            <Switch
              value={watchSettings.syncServiceAlerts}
              onValueChange={(syncServiceAlerts) => setWatchSettings({ syncServiceAlerts })}
              trackColor={{ false: c.separator, true: c.primary }}
              disabled={!watchSettings.syncEnabled}
            />
          </Cell>
        </GroupedList>

        <SectionHeader title="Trip alarm on watch" />
        <GroupedList>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Haptic reminder
            </Txt>
            <Switch
              value={watchSettings.hapticOnAlarm}
              onValueChange={(hapticOnAlarm) => setWatchSettings({ hapticOnAlarm })}
              trackColor={{ false: c.separator, true: c.primary }}
              disabled={!watchSettings.syncEnabled}
            />
          </Cell>
        </GroupedList>
        <Txt
          size={13}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, marginBottom: 12, lineHeight: 18 }}
        >
          Tap on your wrist when a trip alarm fires. Phone notifications must be on for alarms (
          {enableNotifications ? "on" : "off"}).
        </Txt>

        <SectionHeader title="Summary" />
        <View
          style={{
            marginHorizontal: SPACING.screen,
            padding: 14,
            borderRadius: 10,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.separator,
            gap: 6,
          }}
        >
          <Txt size={14} color={c.textSecondary}>
            Face:{" "}
            <Txt size={14} weight="600" color={c.text}>
              {watchSettings.syncEnabled
                ? watchComplicationLabel(watchSettings.complication)
                : "Sync off"}
            </Txt>
          </Txt>
          {watchSettings.complication === "next_departure" && primaryStop ? (
            <Txt size={14} color={c.textSecondary}>
              Stop:{" "}
              <Txt size={14} weight="600" color={c.text}>
                {shortStationName(primaryStop.station_name)}
              </Txt>
            </Txt>
          ) : null}
          <Txt size={14} color={c.textSecondary}>
            Data: {favorites.length} favourites · {savedTrips.length} trips · {activeAlarms}{" "}
            active alarms
          </Txt>
          <Txt size={14} color={c.textSecondary}>
            Refresh every {watchSettings.refreshMinutes} min
          </Txt>
        </View>

        <SectionHeader title="Related" />
        <GroupedList>
          <Cell
            minHeight={MIN_TOUCH}
            onPress={() => router.push("/(tabs)/favourites" as never)}
          >
            <MapPin size={20} color={c.primary} strokeWidth={2} />
            <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap }}>
              Manage favourites
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
          <Cell minHeight={MIN_TOUCH} onPress={() => router.push("/alarms" as never)}>
            <Clock size={20} color={c.primary} strokeWidth={2} />
            <Txt size={16} color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap }}>
              Trip alarms
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
        </GroupedList>
      </Page>
    </View>
  );
}
