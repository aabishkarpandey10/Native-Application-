import { Pressable, ScrollView, Text } from "react-native";

interface FilterPillsProps<T extends string> {
  options: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}

export function FilterPills<T extends string>({ options, active, onChange }: FilterPillsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-4 grow-0"
      contentContainerStyle={{ paddingRight: 8 }}
    >
      {options.map((opt, idx) => {
        const isActive = active === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
              marginRight: idx < options.length - 1 ? 8 : 0,
            })}
            className={`px-4 py-2 rounded-full ${
              isActive
                ? "bg-brand-primary"
                : "bg-surface-card border border-surface-border"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${isActive ? "text-white" : "text-zinc-400"}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
