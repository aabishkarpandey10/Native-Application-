import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Switch, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUpDown, ChevronRight } from "lucide-react-native";
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
import { MIN_TOUCH, SPACING, resolveTextStyle } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useSafeBack } from "../hooks/useSafeBack";
import { useStore, type AlarmTrip } from "../store/store";
import { scheduleTripAlarm } from "../services/tripAlarmService";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";
import { formatSydneyTime } from "../utils/tfnswTime";
import { shortStationName } from "../utils/tripViewFormat";

const LEAD_OPTIONS = [5, 10, 15, 20, 30, 45];

function parseTimeParts(iso?: string): { hour: string; minute: string; dayOffset: 0 | 1 } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 45);
    return {
      hour: String(now.getHours()).padStart(2, "0"),
      minute: String(now.getMinutes()).padStart(2, "0"),
      dayOffset: 0,
    };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = target.getTime() > today.getTime() ? 1 : 0;
  return {
    hour: String(d.getHours()).padStart(2, "0"),
    minute: String(d.getMinutes()).padStart(2, "0"),
    dayOffset,
  };
}

function buildDepartIso(hour: string, minute: string, dayOffset: 0 | 1): string {
  const h = Math.min(23, Math.max(0, parseInt(hour, 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(minute, 10) || 0));
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (dayOffset === 1) d.setDate(d.getDate() + 1);
  if (d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

export default function AlarmEditorScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack("/alarms");
  const { alarmId } = useLocalSearchParams<{ alarmId?: string }>();
  const editingId = alarmId ? String(alarmId) : null;

  const draft = useStore((s) => s.alarmDraft);
  const setAlarmDraft = useStore((s) => s.setAlarmDraft);
  const addAlarmTrip = useStore((s) => s.addAlarmTrip);
  const updateAlarmTrip = useStore((s) => s.updateAlarmTrip);
  const existing = useStore((s) =>
    editingId ? s.alarmTrips.find((a) => a.id === editingId) : undefined
  );
  const enableNotifications = useStore((s) => s.enableNotifications);

  const initial = useMemo(() => parseTimeParts(draft.departAt), [draft.departAt]);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [dayOffset, setDayOffset] = useState<0 | 1>(initial.dayOffset);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  useEffect(() => {
    const parts = parseTimeParts(draft.departAt);
    setHour(parts.hour);
    setMinute(parts.minute);
    setDayOffset(parts.dayOffset);
  }, [draft.departAt]);

  const departIso = buildDepartIso(hour, minute, dayOffset);
  const wakeIso = new Date(new Date(departIso).getTime() - draft.leadMinutes * 60_000).toISOString();

  const pickStation = (role: "from" | "to") => {
    router.push({
      pathname: "/station-picker",
      params: { role, mode: "train", flow: "alarm" },
    } as never);
  };

  const swapStations = () => {
    if (!draft.origin_id || !draft.destination_id) return;
    setAlarmDraft({
      origin_id: draft.destination_id,
      origin_name: draft.destination_name,
      destination_id: draft.origin_id,
      destination_name: draft.origin_name,
    });
  };

  const onSave = async () => {
    if (!draft.origin_id || !draft.destination_id) {
      Alert.alert("Choose stations", "Select both origin and destination for this alarm trip.");
      return;
    }
    if (!enableNotifications && enabled) {
      Alert.alert(
        "Turn on notifications",
        "Enable notifications in Trip alarms to receive reminders."
      );
      return;
    }

    const alarm: AlarmTrip = {
      id: editingId ?? `alarm_${Date.now()}`,
      origin_id: draft.origin_id,
      origin_name: draft.origin_name ?? "Origin",
      destination_id: draft.destination_id,
      destination_name: draft.destination_name ?? "Destination",
      transit_mode: draft.transit_mode ?? "train",
      route_number: draft.route_number,
      departAt: departIso,
      leadMinutes: draft.leadMinutes,
      label: draft.label.trim() || undefined,
      enabled,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (enabled) {
      const result = await scheduleTripAlarm(alarm);
      if (!result.ok) {
        Alert.alert("Could not set alarm", result.reason ?? "Try a later departure time.");
        return;
      }
    }

    if (editingId) updateAlarmTrip(alarm);
    else addAlarmTrip(alarm);

    Alert.alert(
      editingId ? "Alarm updated" : "Alarm set",
      enabled
        ? `We will remind you at ${formatSydneyTime(new Date(wakeIso), {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}.`
        : "Alarm saved but turned off."
    );
    goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title={editingId ? "Edit alarm trip" : "Set alarm trip"}
        left={<BackButton variant="plain" onPress={goBack} />}
      />

      <Page>
        <SectionHeader title="Trip" />
        <GroupedList>
          <Cell onPress={() => pickStation("from")} minHeight={MIN_TOUCH}>
            <Txt size={13} color={c.textSecondary} style={{ width: 72 }}>
              From
            </Txt>
            <Txt size={17} weight="500" color={c.text} style={{ flex: 1 }} numberOfLines={1}>
              {draft.origin_name ? shortStationName(draft.origin_name) : "Choose station"}
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
          <Cell onPress={() => pickStation("to")} minHeight={MIN_TOUCH}>
            <Txt size={13} color={c.textSecondary} style={{ width: 72 }}>
              To
            </Txt>
            <Txt size={17} weight="500" color={c.text} style={{ flex: 1 }} numberOfLines={1}>
              {draft.destination_name ? shortStationName(draft.destination_name) : "Choose station"}
            </Txt>
            <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
          </Cell>
          <Cell onPress={swapStations} minHeight={MIN_TOUCH}>
            <ArrowUpDown size={20} color={c.primary} strokeWidth={2} />
            <Txt size={16} weight="500" color={c.primary} style={{ marginLeft: SPACING.iconGap }}>
              Swap origin and destination
            </Txt>
          </Cell>
        </GroupedList>

        <SectionHeader title="Alarm details" />
        <GroupedList>
          <View style={{ paddingHorizontal: SPACING.cell, paddingVertical: 12, backgroundColor: c.card }}>
            <Txt size={13} color={c.textSecondary}>
              Label (optional)
            </Txt>
            <TextInput
              value={draft.label}
              onChangeText={(text) => setAlarmDraft({ label: text })}
              placeholder="e.g. Morning commute"
              placeholderTextColor={c.textSecondary}
              style={{
                marginTop: 6,
                fontSize: 17,
                color: c.text,
                paddingVertical: 8,
              }}
            />
          </View>
        </GroupedList>

        <SectionHeader title="Departure time" />
        <View style={{ paddingHorizontal: SPACING.screen, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Today" active={dayOffset === 0} onPress={() => setDayOffset(0)} />
            <Chip label="Tomorrow" active={dayOffset === 1} onPress={() => setDayOffset(1)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={hour}
              onChangeText={(t) => setHour(t.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="HH"
              placeholderTextColor={c.textSecondary}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 22,
                ...resolveTextStyle("600"),
                color: c.text,
                backgroundColor: c.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.separator,
                paddingVertical: 12,
              }}
            />
            <Txt size={22} weight="700" color={c.text}>
              :
            </Txt>
            <TextInput
              value={minute}
              onChangeText={(t) => setMinute(t.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor={c.textSecondary}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 22,
                ...resolveTextStyle("600"),
                color: c.text,
                backgroundColor: c.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.separator,
                paddingVertical: 12,
              }}
            />
          </View>
        </View>

        <SectionHeader title="Remind me before" />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: SPACING.screen,
          }}
        >
          {LEAD_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={`${m} min`}
              active={draft.leadMinutes === m}
              onPress={() => setAlarmDraft({ leadMinutes: m })}
            />
          ))}
        </View>

        <SectionHeader title="Summary" />
        <View
          style={{
            marginHorizontal: SPACING.screen,
            padding: 14,
            borderRadius: 10,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.separator,
          }}
        >
          <Txt size={14} color={c.textSecondary}>
            Notification at{" "}
            <Txt size={14} weight="600" color={c.text}>
              {formatSydneyTime(new Date(wakeIso), {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Txt>
            {dayOffset === 1 ? " tomorrow" : " today"}
          </Txt>
          <Txt size={14} color={c.textSecondary} style={{ marginTop: 6 }}>
            Planned departure around{" "}
            <Txt size={14} weight="600" color={c.text}>
              {formatSydneyTime(new Date(departIso), {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Txt>
          </Txt>
          {!isNativeNotificationsSupported() ? (
            <Txt size={13} color={c.textSecondary} style={{ marginTop: 8 }}>
              Scheduling works on the mobile app only.
            </Txt>
          ) : null}
        </View>

        <GroupedList style={{ marginTop: 16 }}>
          <Cell minHeight={MIN_TOUCH}>
            <Txt size={16} color={c.text} style={{ flex: 1 }}>
              Alarm enabled
            </Txt>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: c.separator, true: c.primary }}
            />
          </Cell>
        </GroupedList>

        <Pressable
          onPress={() => void onSave()}
          style={({ pressed }) => ({
            marginHorizontal: SPACING.screen,
            marginTop: 24,
            minHeight: MIN_TOUCH + 4,
            borderRadius: 10,
            backgroundColor: pressed ? c.separator : c.primary,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Txt size={17} weight="600" color="#FFFFFF">
            {editingId ? "Save changes" : "Set alarm"}
          </Txt>
        </Pressable>
      </Page>
    </View>
  );
}
