import { View } from "react-native";
import { RADIUS, scheduleCountdownStyle } from "../../constants/design";
import { useMinuteTicker } from "../../hooks/useMinuteTicker";
import { useColors } from "../../hooks/useColors";
import { formatClock, minutesUntil } from "../../utils/tfnswTime";
import { Txt } from "../design/Txt";

interface ScheduleTimeBlockProps {
  departsAt?: string;
  clock?: string;
  minutes?: number;
  delayed?: boolean;
}

/** Departure clock + countdown pill for schedule cards. */
export function ScheduleTimeBlock({ departsAt, clock, minutes = 0, delayed }: ScheduleTimeBlockProps) {
  useMinuteTicker(15_000);
  const c = useColors();

  const when = departsAt ? new Date(departsAt) : null;
  const liveMinutes = when ? minutesUntil(when) : minutes;
  const liveClock = when ? formatClock(when) : (clock ?? "—");
  const countdown = scheduleCountdownStyle(liveMinutes, delayed, c.isDark);
  const label = liveMinutes <= 0 ? "Now" : `${liveMinutes} min`;

  return (
    <View style={{ alignItems: "flex-end", minWidth: 64, flexShrink: 0 }}>
      <Txt size={20} weight="700" color={c.text} tabularNums tracking={-0.5}>
        {liveClock}
      </Txt>
      <View
        style={{
          marginTop: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: RADIUS.pill,
          backgroundColor: countdown.bg,
          borderWidth: 1,
          borderColor: countdown.border,
        }}
      >
        <Txt size={12} weight="600" color={countdown.fg}>
          {label}
        </Txt>
      </View>
    </View>
  );
}
