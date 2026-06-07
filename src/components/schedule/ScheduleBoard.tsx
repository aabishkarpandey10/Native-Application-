import { type ReactNode } from "react";
import { View } from "react-native";
import { SPACING } from "../../constants/design";

interface ScheduleBoardProps {
  children: ReactNode;
  inset?: number;
}

/** Spaced card list for train / station schedules. */
export function ScheduleBoard({ children, inset = SPACING.screen }: ScheduleBoardProps) {
  return <View style={{ paddingHorizontal: inset, gap: 10 }}>{children}</View>;
}
