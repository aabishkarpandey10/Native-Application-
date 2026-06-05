import { Pressable } from "react-native";
import { MIN_TOUCH } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "./Txt";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

/** Filter pill — comfortable tap target. */
export function Chip({ label, active, onPress }: ChipProps) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        backgroundColor: active ? c.primary : c.muted,
        borderRadius: 999,
        paddingHorizontal: 16,
        minHeight: MIN_TOUCH - 8,
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt size={13} weight="600" color={active ? "#FFFFFF" : c.textSecondary}>
        {label}
      </Txt>
    </Pressable>
  );
}
