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
  large?: boolean;
}

/** Compact departure clock for list previews (e.g. saved stops). */
export function DepartureTime({ departsAt, clock, minutes = 0, delayed, large }: DepartureTimeProps) {
  useMinuteTicker(15_000);
  const c = useColors();

  const when = departsAt ? new Date(departsAt) : null;
  const liveMinutes = when ? minutesUntil(when) : minutes;
  const liveClock = when ? formatClock(when) : (clock ?? "—");

  const color = countdownColor(liveMinutes, delayed);
  const label = liveMinutes <= 0 ? "Now" : `${liveMinutes}m`;

  return (
    <View style={{ alignItems: "flex-end", minWidth: large ? 72 : 52, flexShrink: 0 }}>
      <Txt size={large ? 20 : 16} weight="700" color={c.text} tabularNums>
        {liveClock}
      </Txt>
      <Txt size={12} weight="600" color={color} style={{ marginTop: 3 }}>
        {label}
      </Txt>
    </View>
  );
}
