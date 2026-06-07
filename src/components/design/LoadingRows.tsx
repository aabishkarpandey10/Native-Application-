import { View } from "react-native";
import { HAIRLINE, RADIUS, cardShadow } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { ScheduleBoard } from "../schedule/ScheduleBoard";

function SkeletonBar({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: c.isDark ? "#2A2D38" : "#E5E7EB",
      }}
    />
  );
}

/** Placeholder cards while departures load. */
export function DepartureLoadingRows({ count = 4 }: { count?: number }) {
  const c = useColors();
  return (
    <ScheduleBoard>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            {
              flexDirection: "row",
              alignItems: "stretch",
              backgroundColor: c.card,
              borderRadius: RADIUS.card,
              borderWidth: HAIRLINE,
              borderColor: c.border,
              overflow: "hidden",
              minHeight: 80,
            },
            cardShadow(c.isDark),
          ]}
        >
          <View style={{ width: 4, backgroundColor: c.separator }} />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <SkeletonBar width={34} height={24} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBar width="72%" height={16} />
              <SkeletonBar width="48%" height={12} />
            </View>
            <SkeletonBar width={56} height={40} />
          </View>
        </View>
      ))}
    </ScheduleBoard>
  );
}
