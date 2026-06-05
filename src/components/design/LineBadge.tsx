import { View } from "react-native";
import { lineColor, RADIUS } from "../../constants/design";
import { compactRouteCode } from "../../utils/transitColors";
import { Txt } from "./Txt";

interface LineBadgeProps {
  route: string;
  small?: boolean;
  color?: string;
}

/** TripView-style square line badge (T1, T2, …). */
export function LineBadge({ route, small, color }: LineBadgeProps) {
  const code = compactRouteCode(route);
  const bg = color ?? lineColor(code);
  const h = small ? 22 : 28;
  const w = small ? 32 : 40;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: RADIUS.badge,
        width: w,
        height: h,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Txt size={small ? 11 : 13} weight="700" color="#FFFFFF" numberOfLines={1}>
        {code}
      </Txt>
    </View>
  );
}
