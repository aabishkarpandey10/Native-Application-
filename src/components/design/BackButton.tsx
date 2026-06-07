import { Pressable, type ViewStyle } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { MIN_TOUCH, RADIUS } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

interface BackButtonProps {
  onPress: () => void;
  /** Plain chevron matches web + mobile tab/stack headers (default). */
  variant?: "pill" | "plain";
  style?: ViewStyle;
}

/** Consistent back control — same on web and Expo Go. */
export function BackButton({ onPress, variant = "plain", style }: BackButtonProps) {
  const c = useColors();

  if (variant === "plain") {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={[
          { width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: "center", alignItems: "flex-start" },
          style,
        ]}
      >
        <ChevronLeft size={26} color={c.text} strokeWidth={2.2} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={10}
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: RADIUS.pill,
          backgroundColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <ChevronLeft size={22} color={c.text} strokeWidth={2.2} />
    </Pressable>
  );
}
