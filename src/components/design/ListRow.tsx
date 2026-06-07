import { type ReactNode } from "react";
import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Cell } from "./GroupedList";
import { Txt } from "./Txt";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

export interface ListRowProps {
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  minHeight?: number;
  accessibilityLabel?: string;
  trailing?: ReactNode;
}

/** TripView-style grouped list row — same layout on web and mobile. */
export function ListRow({
  label,
  subtitle,
  icon,
  value,
  onPress,
  showChevron = true,
  minHeight = MIN_TOUCH,
  accessibilityLabel,
  trailing,
}: ListRowProps) {
  const c = useColors();

  return (
    <Cell
      onPress={onPress}
      minHeight={subtitle ? Math.max(minHeight, 56) : minHeight}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, marginLeft: icon ? SPACING.iconGap : 0 }}>
        <Txt size={17} color={c.text} numberOfLines={1}>
          {label}
        </Txt>
        {subtitle ? (
          <Txt size={13} color={c.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt size={16} color={c.textSecondary} style={{ marginRight: 4, flexShrink: 0 }}>
          {value}
        </Txt>
      ) : null}
      {trailing}
      {showChevron && onPress ? (
        <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
      ) : null}
    </Cell>
  );
}
