import { Children, type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { HAIRLINE } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

interface GroupedListProps {
  children: ReactNode;
  style?: ViewStyle;
  /** horizontal margin (defaults to 16; 0 = TripView full-bleed table) */
  inset?: number;
  /** inset for row separators (defaults to 16; use ~60 when rows have leading icons) */
  separatorInset?: number;
  /** TripView flat timetable — no rounded corners, edge-to-edge white rows */
  flat?: boolean;
}

/** Grouped table (rounded inset) or TripView flat departure board. */
export function GroupedList({
  children,
  style,
  inset = 16,
  separatorInset = 16,
  flat = false,
}: GroupedListProps) {
  const c = useColors();
  const items = Children.toArray(children).filter(Boolean);

  if (flat) {
    return (
      <View
        style={[
          {
            backgroundColor: c.card,
            borderTopWidth: HAIRLINE,
            borderBottomWidth: HAIRLINE,
            borderColor: c.separator,
          },
          style,
        ]}
      >
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={{ height: HAIRLINE, backgroundColor: c.separator, marginLeft: 56 }} /> : null}
            {child}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          marginHorizontal: inset,
          backgroundColor: c.card,
          borderRadius: 10,
          overflow: "hidden",
          borderWidth: HAIRLINE,
          borderColor: c.separator,
        },
        style,
      ]}
    >
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View
              style={{
                height: HAIRLINE,
                backgroundColor: c.separator,
                marginLeft: separatorInset,
              }}
            />
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

interface CellProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  minHeight?: number;
  accessibilityLabel?: string;
}

/** Single row inside a GroupedList or flat table. */
export function Cell({ children, onPress, style, minHeight = 56, accessibilityLabel }: CellProps) {
  const c = useColors();
  const content = (
    <View
      style={[
        {
          minHeight,
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: c.separator }}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {content}
    </Pressable>
  );
}
