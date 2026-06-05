import { Text, type TextProps, type TextStyle } from "react-native";
import { interFamily } from "../../constants/design";

type Weight = "400" | "500" | "600" | "700" | "800";

interface TxtProps extends TextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  lineHeight?: number;
  tracking?: number;
  uppercase?: boolean;
  tabularNums?: boolean;
}

const WEIGHT_MAP: Record<Weight, TextStyle["fontWeight"]> = {
  "400": "400",
  "500": "500",
  "600": "600",
  "700": "700",
  "800": "800",
};

/** Inter typography — consistent with web. */
export function Txt({
  size = 15,
  weight = "400",
  color,
  lineHeight,
  tracking,
  uppercase,
  tabularNums,
  style,
  children,
  ...rest
}: TxtProps) {
  const base: TextStyle = {
    fontSize: size,
    color: color ?? "#000000",
    fontFamily: interFamily(weight),
    fontWeight: WEIGHT_MAP[weight],
  };
  if (lineHeight != null) base.lineHeight = lineHeight;
  if (tracking != null) base.letterSpacing = tracking;
  if (uppercase) base.textTransform = "uppercase";
  if (tabularNums) base.fontVariant = ["tabular-nums"];

  return (
    <Text style={[base, style]} {...rest}>
      {children}
    </Text>
  );
}
