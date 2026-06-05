import { View } from "react-native";
import { countdownColor } from "../../constants/design";
import { useMinuteTicker } from "../../hooks/useMinuteTicker";
import { useColors } from "../../hooks/useColors";
import { formatClock, minutesUntil } from "../../utils/tfnswTime";
import { Txt } from "./Txt";

interface DepartureTimeProps {
  departsAt?: string;
  clock?: string;
  minutes?: number;
  delayed?: boolean;
  /** TripView timetable uses larger clock on the right */
  large?: boolean;
}

/** Right-aligned departure clock + live countdown (TripView style). */
export function DepartureTime({ departsAt, clock, minutes = 0, delayed, large }: DepartureTimeProps) {
  useMinuteTicker(15_000);
  const c = useColors();

  const when = departsAt ? new Date(departsAt) : null;
  const liveMinutes = when ? minutesUntil(when) : minutes;
  const liveClock = when ? formatClock(when) : (clock ?? "—");

  const color = countdownColor(liveMinutes, delayed);
  const label = liveMinutes <= 0 ? "Due" : `${liveMinutes} min`;

  return (
    <View style={{ alignItems: "flex-end", minWidth: large ? 72 : 56, flexShrink: 0 }}>
      <Txt size={large ? 24 : 18} weight="600" color={delayed ? color : c.text} tabularNums>
        {liveClock}
      </Txt>
      <Txt size={13} weight="500" color={color} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}
