import { View } from "react-native";
import { lineColor, RADIUS } from "../../constants/design";
import { compactRouteCode } from "../../utils/transitColors";
import { Txt } from "./Txt";

interface LineBadgeProps {
  route: string;
  small?: boolean;
  color?: string;
}

/** Rounded route pill — NSW line colour. */
export function LineBadge({ route, small, color }: LineBadgeProps) {
  const code = compactRouteCode(route);
  const bg = color ?? lineColor(code);
  const h = small ? 26 : 30;
  const minW = small ? 40 : 46;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: RADIUS.pill,
        minWidth: minW,
        height: h,
        paddingHorizontal: 10,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt
        size={small ? 11 : 12}
        weight="700"
        color="#FFFFFF"
        numberOfLines={1}
        tracking={-0.2}
        style={{ lineHeight: small ? 14 : 16 }}
      >
        {code}
      </Txt>
    </View>
  );
}
