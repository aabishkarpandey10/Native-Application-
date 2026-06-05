import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="py-12 px-6 items-center bg-surface-card border border-surface-border rounded-2xl">
      {icon ? (
        <View className="w-14 h-14 rounded-xl bg-surface-elevated border border-surface-border items-center justify-center mb-4">
          {icon}
        </View>
      ) : null}
      <Text className="text-white font-semibold text-base text-center">{title}</Text>
      {message ? (
        <Text className="text-zinc-500 text-sm text-center mt-2 leading-5 max-w-[280px]">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          className="mt-4 px-5 py-2.5 bg-brand-primary rounded-xl"
        >
          <Text className="text-white font-semibold text-sm">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
