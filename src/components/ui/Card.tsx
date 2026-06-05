import { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, className = "", onPress, style }: CardProps) {
  const baseClass = `bg-surface-card border border-surface-border rounded-2xl overflow-hidden ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={baseClass}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View className={baseClass} style={style}>
      {children}
    </View>
  );
}
