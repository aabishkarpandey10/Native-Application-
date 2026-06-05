import { Pressable, Text, View } from "react-native";
import ModeBadge from "../ModeBadge";
import { HOME_TRANSPORT_MODES, getModeColor } from "../../constants/transportModes";

type ModeKey = (typeof HOME_TRANSPORT_MODES)[number]["key"];

interface TransportModeGridProps {
  onSelect?: (mode: ModeKey) => void;
}

export function TransportModeGrid({ onSelect }: TransportModeGridProps) {
  return (
    <View className="flex-row justify-between gap-2 mb-5">
      {HOME_TRANSPORT_MODES.map(({ key, label }) => {
        const color = getModeColor(key);
        return (
          <Pressable
            key={key}
            onPress={() => onSelect?.(key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, flex: 1, maxWidth: 72 })}
            className="items-center"
          >
            <View
              className="w-full aspect-square rounded-2xl items-center justify-center mb-2 border border-surface-border"
              style={{ backgroundColor: `${color}18`, maxHeight: 72 }}
            >
              <ModeBadge mode={key} size="lg" />
            </View>
            <Text className="text-zinc-400 text-[10px] font-medium text-center" numberOfLines={2}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
