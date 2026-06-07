import { Pressable } from "react-native";
import { MIN_TOUCH, RADIUS, SPACING } from "../../constants/design";
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
        backgroundColor: active ? c.primary : c.card,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.cell,
        minHeight: MIN_TOUCH - 8,
        justifyContent: "center",
        borderWidth: active ? 0 : 1,
        borderColor: c.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Txt size={13} weight="600" color={active ? "#FFFFFF" : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
}
