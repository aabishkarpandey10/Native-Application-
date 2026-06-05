import { View } from "react-native";
import { useColors } from "../../hooks/useColors";

function SkeletonBar({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  const c = useColors();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 4,
        backgroundColor: c.isDark ? "#3A3A3C" : "#E5E5EA",
      }}
    />
  );
}

/** Placeholder rows while departures load. */
export function DepartureLoadingRows({ count = 4 }: { count?: number }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.card }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: i < count - 1 ? 0.5 : 0,
            borderBottomColor: c.separator,
            gap: 12,
          }}
        >
          <SkeletonBar width={40} height={28} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBar width="70%" height={16} />
            <SkeletonBar width="45%" height={12} />
          </View>
          <SkeletonBar width={56} height={36} />
        </View>
      ))}
    </View>
  );
}
