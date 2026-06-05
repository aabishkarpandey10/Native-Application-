import { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

interface IconButtonProps extends Pick<PressableProps, "accessibilityLabel" | "accessibilityRole"> {
  onPress?: () => void;
  children: ReactNode;
  variant?: "default" | "primary";
}

export function IconButton({
  onPress,
  children,
  variant = "default",
  accessibilityLabel,
  accessibilityRole = "button",
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      className={`w-11 h-11 rounded-xl items-center justify-center border ${
        variant === "primary"
          ? "bg-brand-primary border-brand-primary"
          : "bg-surface-card border-surface-border"
      }`}
    >
      {children}
    </Pressable>
  );
}
