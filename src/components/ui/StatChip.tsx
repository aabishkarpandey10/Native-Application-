import { Text, View } from "react-native";

interface StatChipProps {
  label: string;
  value: string | number;
}

export function StatChip({ label, value }: StatChipProps) {
  return (
    <View className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 items-center justify-center">
      <Text className="text-white font-bold text-base tabular-nums" numberOfLines={1}>
        {value}
      </Text>
      <Text
        className="text-zinc-500 text-[10px] mt-0.5 font-medium uppercase tracking-wide"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
