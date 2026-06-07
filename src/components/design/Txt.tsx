import { Platform, Text, type TextProps, type TextStyle } from "react-native";
import { resolveTextStyle } from "../../constants/typography";

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

/** Inter typography — consistent on web, iOS, and Android release builds. */
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
    ...resolveTextStyle(weight),
  };
  if (lineHeight != null) base.lineHeight = lineHeight;
  if (Platform.OS === "android") {
    base.includeFontPadding = false;
    base.textAlignVertical = "center";
  }
  if (tracking != null) base.letterSpacing = tracking;
  if (uppercase) base.textTransform = "uppercase";
  if (tabularNums) base.fontVariant = ["tabular-nums"];

  return (
    <Text allowFontScaling={false} style={[base, style]} {...rest}>
      {children}
    </Text>
  );
}
