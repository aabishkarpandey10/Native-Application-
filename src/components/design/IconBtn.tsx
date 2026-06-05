import { Pressable } from "react-native";
import { MIN_TOUCH } from "../../constants/design";

interface IconBtnProps {
  onPress?: () => void;
  children: React.ReactNode;
  label?: string;
  size?: number;
}

/** Tappable icon target (min 44×44 for accessibility). */
export function IconBtn({ onPress, children, label, size = MIN_TOUCH }: IconBtnProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
