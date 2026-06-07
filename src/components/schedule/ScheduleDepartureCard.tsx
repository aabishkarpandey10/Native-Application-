import { Pressable, View } from "react-native";
import { SEMANTIC, HAIRLINE, RADIUS, SPACING, cardShadow, lineColor } from "../../constants/design";
import type { SampleDeparture } from "../../constants/sampleData";
import { clockFromNow } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import { LineBadge } from "../design/LineBadge";
import { ScheduleTimeBlock } from "./ScheduleTimeBlock";
import { Txt } from "../design/Txt";

interface ScheduleDepartureCardProps {
  departure: SampleDeparture;
  onPress?: () => void;
  compact?: boolean;
}

/** Card-based departure row — distinct from TripView flat timetable boards. */
export function ScheduleDepartureCard({ departure, onPress, compact }: ScheduleDepartureCardProps) {
  const c = useColors();
  const d = departure;
  const accent = d.lineColor ?? lineColor(d.route);
  const platformLabel = d.platformLabel ?? "Platform";
  const a11y = `${d.route} to ${d.destination}, ${platformLabel.toLowerCase()} ${d.platform}, ${d.minutes} minutes`;

  const content = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: c.card,
          borderRadius: RADIUS.card,
          borderWidth: HAIRLINE,
          borderColor: c.border,
          overflow: "hidden",
          minHeight: compact ? 72 : 80,
        },
        cardShadow(c.isDark),
      ]}
    >
      <View style={{ width: 4, backgroundColor: accent }} />
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: compact ? 12 : 14,
          paddingHorizontal: SPACING.cell,
          gap: SPACING.iconGap,
        }}
      >
        <LineBadge route={d.route} color={accent} small={compact} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={compact ? 16 : 17} weight="600" color={c.text} numberOfLines={1}>
            {d.destination}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4, gap: 4 }}>
            <Txt size={13} color={c.textSecondary}>
              {platformLabel} {d.platform}
            </Txt>
            {d.via ? (
              <Txt size={13} color={c.textSecondary}>
                · via {d.via}
              </Txt>
            ) : null}
            {d.delayed ? (
              <Txt size={13} weight="600" color={SEMANTIC.destructive}>
                · +{d.delayed}m
              </Txt>
            ) : null}
          </View>
        </View>
        <ScheduleTimeBlock
          departsAt={d.departsAt}
          clock={d.clock ?? clockFromNow(d.minutes)}
          minutes={d.minutes}
          delayed={!!d.delayed}
        />
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      {content}
    </Pressable>
  );
}
