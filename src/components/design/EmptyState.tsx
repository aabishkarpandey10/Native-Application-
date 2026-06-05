import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "./Txt";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

/** Centered empty state for lists and tabs. */
export function EmptyState({ title, message, actionLabel, onAction, icon }: EmptyStateProps) {
  const c = useColors();
  return (
    <View style={{ paddingHorizontal: SPACING.screen, paddingVertical: 40, alignItems: "center" }}>
      {icon ? <View style={{ marginBottom: 16 }}>{icon}</View> : null}
      <Txt size={18} weight="600" color={c.text} style={{ textAlign: "center" }}>
        {title}
      </Txt>
      <Txt size={15} color={c.textSecondary} style={{ textAlign: "center", marginTop: 8, lineHeight: 22 }}>
        {message}
      </Txt>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={{
            marginTop: 20,
            backgroundColor: c.primary,
            paddingHorizontal: 24,
            minHeight: MIN_TOUCH,
            borderRadius: 8,
            justifyContent: "center",
          }}
        >
          <Txt size={16} weight="600" color="#FFFFFF">
            {actionLabel}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}
