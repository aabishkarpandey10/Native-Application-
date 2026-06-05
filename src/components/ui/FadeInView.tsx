import { ReactNode } from "react";
import { View } from "react-native";

interface FadeInViewProps {
  children: ReactNode;
  index?: number;
  className?: string;
}

/** Stable wrapper — no enter animation (avoids layout jump on filter/refresh). */
export function FadeInView({ children, className }: FadeInViewProps) {
  return <View className={className}>{children}</View>;
}
