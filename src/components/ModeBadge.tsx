import { View, Text, type TextStyle, type ViewStyle } from "react-native";
import { getModeConfig, normalizeTransportMode } from "../constants/transportModes";

interface ModeBadgeProps {
  mode: "train" | "metro" | "bus" | "lightrail" | "light_rail" | "ferry" | string;
  size?: "sm" | "md" | "lg";
  style?: ViewStyle;
}

const BADGE_SIZE = { sm: 20, md: 28, lg: 40 } as const;
const TEXT_SIZE: Record<"sm" | "md" | "lg", TextStyle["fontSize"]> = {
  sm: 9,
  md: 12,
  lg: 16,
};

export function ModeBadge({ mode, size = "md", style }: ModeBadgeProps) {
  const config = getModeConfig(String(mode));
  const dim = BADGE_SIZE[size];

  return (
    <View
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: config.color,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: TEXT_SIZE[size],
          fontWeight: "900",
          color: "#FFFFFF",
          textAlign: "center",
          letterSpacing: -0.5,
        }}
      >
        {config.char}
      </Text>
    </View>
  );
}

export function getModeLabel(mode: string): string {
  return getModeConfig(mode).label;
}

export { normalizeTransportMode };

export default ModeBadge;
