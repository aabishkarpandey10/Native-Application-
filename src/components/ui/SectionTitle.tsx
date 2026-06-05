import { Text, View } from "react-native";

interface SectionTitleProps {
  title: string;
  count?: number;
}

export function SectionTitle({ title, count }: SectionTitleProps) {
  return (
    <View className="flex-row items-center justify-between mb-3.5 mt-1">
      <Text className="text-[15px] font-semibold text-zinc-100 tracking-tight">{title}</Text>
      {count !== undefined ? (
        <View className="bg-surface-elevated px-2.5 py-0.5 rounded-full border border-surface-border">
          <Text className="text-zinc-400 text-xs font-medium">{count}</Text>
        </View>
      ) : null}
    </View>
  );
}
