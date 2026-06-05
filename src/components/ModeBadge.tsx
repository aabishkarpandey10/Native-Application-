import { View, Text } from "react-native";
import { getModeConfig, normalizeTransportMode } from "../constants/transportModes";

interface ModeBadgeProps {
  mode: "train" | "metro" | "bus" | "lightrail" | "light_rail" | "ferry" | string;
  size?: "sm" | "md" | "lg";
  textClassName?: string;
  badgeClassName?: string;
}

export function ModeBadge({
  mode,
  size = "md",
  textClassName = "",
  badgeClassName = "",
}: ModeBadgeProps) {
  const config = getModeConfig(String(mode));

  const badgeDimensions = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  const textDimensions = {
    sm: "text-[9px]",
    md: "text-[12px]",
    lg: "text-[16px]",
  };

  return (
    <View
      className={`items-center justify-center rounded-full ${badgeDimensions[size]} ${badgeClassName}`}
      style={{ backgroundColor: config.color }}
    >
      <Text
        className={`font-black text-white text-center tracking-tighter ${textDimensions[size]} ${textClassName}`}
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
