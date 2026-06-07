import { Alert, Pressable, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { Bell, Plus, Trash2 } from "lucide-react-native";
import { BackButton, Cell, GroupedList, Page, SectionHeader, Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { MIN_TOUCH, SPACING } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useStore, type AlarmTrip } from "../store/store";
import { formatSydneyTime } from "../utils/tfnswTime";
import { shortStationName } from "../utils/tripViewFormat";
import { useSafeBack } from "../hooks/useSafeBack";
import {
  cancelTripAlarm,
  scheduleTripAlarm,
} from "../services/tripAlarmService";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";

function shortTripLabel(alarm: AlarmTrip): string {
  return `${shortStationName(alarm.origin_name)} → ${shortStationName(alarm.destination_name)}`;
}

function wakeLabel(alarm: AlarmTrip): string {
  const wake = new Date(new Date(alarm.departAt).getTime() - alarm.leadMinutes * 60_000);
  return formatSydneyTime(wake, { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function AlarmsScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/tools");
  const alarmTrips = useStore((s) => s.alarmTrips);
  const removeAlarmTrip = useStore((s) => s.removeAlarmTrip);
  const updateAlarmTrip = useStore((s) => s.updateAlarmTrip);
  const enableNotifications = useStore((s) => s.enableNotifications);
  const setEnableNotifications = useStore((s) => s.setEnableNotifications);
  const resetAlarmDraft = useStore((s) => s.resetAlarmDraft);

  const openNew = () => {
    resetAlarmDraft();
    router.push("/alarm-editor" as never);
  };

  const openEdit = (alarm: AlarmTrip) => {
    resetAlarmDraft({
      origin_id: alarm.origin_id,
      origin_name: alarm.origin_name,
      destination_id: alarm.destination_id,
      destination_name: alarm.destination_name,
      transit_mode: alarm.transit_mode,
      route_number: alarm.route_number,
      departAt: alarm.departAt,
      leadMinutes: alarm.leadMinutes,
      label: alarm.label ?? "",
    });
    router.push({ pathname: "/alarm-editor", params: { alarmId: alarm.id } } as never);
  };

  const toggleEnabled = async (alarm: AlarmTrip, enabled: boolean) => {
    const next = { ...alarm, enabled };
    updateAlarmTrip(next);
    if (!enabled) {
      await cancelTripAlarm(alarm.id);
      return;
    }
    const result = await scheduleTripAlarm(next);
    if (!result.ok) {
      updateAlarmTrip({ ...alarm, enabled: false });
      Alert.alert("Could not set alarm", result.reason ?? "Try again.");
    }
  };

  const onDelete = (alarm: AlarmTrip) => {
    Alert.alert("Delete alarm trip?", shortTripLabel(alarm), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void cancelTripAlarm(alarm.id);
          removeAlarmTrip(alarm.id);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Trip alarms" left={<BackButton variant="plain" onPress={goBack} />} />

      <Page>
        <SectionHeader title="Notifications" />
        <GroupedList>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Enable notifications
            </Txt>
            <Switch
              value={enableNotifications}
              onValueChange={setEnableNotifications}
              trackColor={{ false: c.separator, true: c.primary }}
            />
          </Cell>
        </GroupedList>
        <Txt size={13} color={c.textSecondary} style={{ paddingHorizontal: SPACING.screen, marginBottom: 12 }}>
          {isNativeNotificationsSupported()
            ? "Trip alarms remind you when to leave for a saved journey."
            : "Trip alarms work on the iOS and Android app."}
        </Txt>

        <Pressable
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel="Set alarm trip"
          style={({ pressed }) => ({
            marginHorizontal: SPACING.screen,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: MIN_TOUCH,
            borderRadius: 10,
            backgroundColor: pressed ? c.separator : c.primary,
            paddingHorizontal: SPACING.cell,
          })}
        >
          <Plus size={22} color="#FFFFFF" strokeWidth={2.4} />
          <Txt size={16} weight="600" color="#FFFFFF">
            Set alarm trip
          </Txt>
        </Pressable>

        <SectionHeader title={alarmTrips.length ? `Your alarms (${alarmTrips.length})` : "Your alarms"} />
        {alarmTrips.length === 0 ? (
          <View
            style={{
              marginHorizontal: SPACING.screen,
              padding: 24,
              borderRadius: 12,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.separator,
              alignItems: "center",
            }}
          >
            <Bell size={32} color={c.textSecondary} strokeWidth={1.8} />
            <Txt size={16} weight="600" color={c.text} style={{ marginTop: 12 }}>
              No trip alarms yet
            </Txt>
            <Txt size={14} color={c.textSecondary} style={{ marginTop: 6, textAlign: "center" }}>
              Create an alarm for a regular trip — we will notify you before you need to leave.
            </Txt>
          </View>
        ) : (
          <GroupedList>
            {alarmTrips.map((alarm) => (
              <Cell key={alarm.id} minHeight={72}>
                <Pressable
                  onPress={() => openEdit(alarm)}
                  style={{ flex: 1, minWidth: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit alarm ${shortTripLabel(alarm)}`}
                >
                  <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
                    {alarm.label?.trim() || shortTripLabel(alarm)}
                  </Txt>
                  <Txt size={14} color={c.textSecondary} numberOfLines={1} style={{ marginTop: 3 }}>
                    {shortTripLabel(alarm)}
                  </Txt>
                  <Txt size={13} color={c.textSecondary} style={{ marginTop: 4 }}>
                    Wake {wakeLabel(alarm)} · Depart{" "}
                    {formatSydneyTime(new Date(alarm.departAt), {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                    {alarm.leadMinutes > 0 ? ` · ${alarm.leadMinutes} min early` : ""}
                  </Txt>
                </Pressable>
                <Switch
                  value={alarm.enabled}
                  onValueChange={(v) => void toggleEnabled(alarm, v)}
                  trackColor={{ false: c.separator, true: c.primary }}
                />
                <Pressable
                  onPress={() => onDelete(alarm)}
                  hitSlop={8}
                  style={{ marginLeft: 8, padding: 6 }}
                  accessibilityLabel="Delete alarm"
                >
                  <Trash2 size={20} color={c.textSecondary} strokeWidth={2} />
                </Pressable>
              </Cell>
            ))}
          </GroupedList>
        )}
      </Page>
    </View>
  );
}
