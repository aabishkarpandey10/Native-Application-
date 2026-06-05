import { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  scale?: number;
}

/** Opacity feedback only — avoids transform glitches in flex rows and nested taps. */
export function PressableScale({
  children,
  className,
  style,
  disabled,
  ...rest
}: PressableScaleProps) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      className={className}
      style={({ pressed }) => [{ opacity: pressed && !disabled ? 0.82 : 1 }, style]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
