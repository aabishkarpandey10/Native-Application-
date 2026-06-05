import { Clock } from "lucide-react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface RecentSearchChipsProps {
  searches: string[];
  onSelect: (query: string) => void;
  onClear?: () => void;
}

export function RecentSearchChips({ searches, onSelect, onClear }: RecentSearchChipsProps) {
  if (searches.length === 0) return null;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center gap-2">
          <Clock size={14} color="#8E8E93" />
          <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-wide">
            Recent
          </Text>
        </View>
        {onClear ? (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text className="text-brand-primary text-xs font-semibold">Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {searches.map((q, idx) => (
          <TouchableOpacity
            key={q}
            onPress={() => onSelect(q)}
            activeOpacity={0.75}
            style={{ marginRight: idx < searches.length - 1 ? 8 : 0 }}
            className="px-3.5 py-2 bg-surface-card border border-surface-border rounded-full"
          >
            <Text className="text-zinc-300 text-sm font-medium" numberOfLines={1}>
              {q}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
