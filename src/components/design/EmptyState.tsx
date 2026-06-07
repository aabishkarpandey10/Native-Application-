import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { cardShadow, MIN_TOUCH, RADIUS, SPACING } from "../../constants/design";
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
      <View
        style={[
          {
            width: "100%",
            maxWidth: 360,
            backgroundColor: c.card,
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 24,
            paddingVertical: 36,
            alignItems: "center",
          },
          cardShadow(c.isDark),
        ]}
      >
        {icon ? <View style={{ marginBottom: 16 }}>{icon}</View> : null}
        <Txt size={20} weight="700" color={c.text} style={{ textAlign: "center" }}>
          {title}
        </Txt>
        <Txt size={15} color={c.textSecondary} style={{ textAlign: "center", marginTop: 8, lineHeight: 22 }}>
          {message}
        </Txt>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            style={({ pressed }) => ({
              marginTop: 22,
              backgroundColor: pressed ? c.header : c.primary,
              paddingHorizontal: 28,
              minHeight: MIN_TOUCH,
              borderRadius: RADIUS.button,
              justifyContent: "center",
            })}
          >
            <Txt size={16} weight="600" color="#FFFFFF">
              {actionLabel}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
