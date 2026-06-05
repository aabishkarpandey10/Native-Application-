import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentControlProps<T>) {
  return (
    <View className="flex-row bg-surface-base p-1 rounded-xl border border-surface-border min-w-[168px]">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            className={`flex-1 flex-row items-center justify-center px-2.5 py-1.5 rounded-lg gap-1 ${
              active ? "bg-brand-primary/25" : ""
            }`}
          >
            {opt.icon}
            <Text
              className={`text-[11px] font-semibold ${
                active ? "text-white" : "text-zinc-500"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
