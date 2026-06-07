import { View } from "react-native";
import { ChevronRight, Bus, MapPin, Ship, TrainFront, TramFront } from "lucide-react-native";
import { Cell } from "../design/GroupedList";
import { Txt } from "../design/Txt";
import { MIN_TOUCH, RADIUS, SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

export type TransportKind = "train" | "metro" | "bus" | "ferry" | "lightrail";

const ICONS: Record<TransportKind, { Icon: typeof TrainFront; color: string }> = {
  train: { Icon: TrainFront, color: "#F6891F" },
  metro: { Icon: TrainFront, color: "#0095A0" },
  bus: { Icon: Bus, color: "#0098CD" },
  ferry: { Icon: Ship, color: "#00A14B" },
  lightrail: { Icon: TramFront, color: "#BE1622" },
};

const ICON_BOX = 36;

function RowContent({
  label,
  Icon,
  iconColor,
}: {
  label: string;
  Icon: typeof TrainFront;
  iconColor: string;
}) {
  const c = useColors();
  return (
    <>
      <View
        style={{
          width: ICON_BOX,
          height: ICON_BOX,
          borderRadius: RADIUS.sm,
          backgroundColor: `${iconColor}18`,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={iconColor} strokeWidth={2.2} />
      </View>
      <Txt
        size={17}
        weight="500"
        color={c.text}
        style={{ flex: 1, marginLeft: SPACING.iconGap, minWidth: 0 }}
      >
        {label}
      </Txt>
      <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
    </>
  );
}

/** Grouped-list row for transport picker (New Trip). */
export function TransportMenuRow({
  label,
  kind,
  onPress,
}: {
  label: string;
  kind: TransportKind;
  onPress: () => void;
}) {
  const { Icon, color } = ICONS[kind];
  return (
    <Cell onPress={onPress} minHeight={MIN_TOUCH} accessibilityLabel={label}>
      <RowContent label={label} Icon={Icon} iconColor={color} />
    </Cell>
  );
}

export function TransportMenuRowPin({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Cell onPress={onPress} minHeight={MIN_TOUCH} accessibilityLabel={label}>
      <RowContent label={label} Icon={MapPin} iconColor="#0098CD" />
    </Cell>
  );
}
