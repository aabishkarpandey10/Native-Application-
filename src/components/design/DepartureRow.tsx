import { View } from "react-native";
import { SEMANTIC } from "../../constants/design";
import type { SampleDeparture } from "../../constants/sampleData";
import { clockFromNow } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import { Cell } from "./GroupedList";
import { DepartureTime } from "./DepartureTime";
import { LineBadge } from "./LineBadge";
import { Txt } from "./Txt";

interface DepartureRowProps {
  departure: SampleDeparture;
  onPress?: () => void;
  minHeight?: number;
  /** Full-bleed TripView timetable row */
  flat?: boolean;
}

/** TripView departure row: line badge · destination · platform · time. */
export function DepartureRow({ departure, onPress, minHeight = 58, flat }: DepartureRowProps) {
  const c = useColors();
  const d = departure;
  const a11y = `${d.route} to ${d.destination}, platform ${d.platform}, ${d.minutes} minutes`;

  return (
    <Cell onPress={onPress} minHeight={minHeight} accessibilityLabel={a11y}>
      <LineBadge route={d.route} color={d.lineColor} />
      <View style={{ flex: 1, marginLeft: flat ? 12 : 12, minWidth: 0 }}>
        <Txt size={17} weight="600" color={c.text} numberOfLines={1}>
          {d.destination}
        </Txt>
        <Txt size={14} color={c.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
          Platform {d.platform}
          {d.via ? ` · via ${d.via}` : ""}
          {d.delayed ? (
            <Txt size={14} weight="600" color={SEMANTIC.destructive}>{` · +${d.delayed}m`}</Txt>
          ) : null}
        </Txt>
      </View>
      <View style={{ marginLeft: 8 }}>
        <DepartureTime
          departsAt={d.departsAt}
          clock={d.clock ?? clockFromNow(d.minutes)}
          minutes={d.minutes}
          delayed={!!d.delayed}
          large={flat}
        />
      </View>
    </Cell>
  );
}
