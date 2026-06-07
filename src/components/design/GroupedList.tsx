import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { HAIRLINE, LIST_TRANSPORT_SEPARATOR, RADIUS, SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

interface GroupedListProps {
  children: ReactNode;
  style?: ViewStyle;
  inset?: number;
  separatorInset?: number;
  flat?: boolean;
}

/** Grouped table (rounded inset) or TripView flat departure board. */
export function GroupedList({
  children,
  style,
  inset = SPACING.screen,
  separatorInset = SPACING.screen,
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
            {i > 0 ? (
              <View
                style={{ height: HAIRLINE, backgroundColor: c.separator, marginLeft: LIST_TRANSPORT_SEPARATOR }}
              />
            ) : null}
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
          borderRadius: RADIUS.card,
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

function flattenRowChildren(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return Children.toArray(child.props.children);
    }
    return [child];
  });
}

/** Single row inside a GroupedList or flat table. */
export function Cell({ children, onPress, style, minHeight = 56, accessibilityLabel }: CellProps) {
  const c = useColors();
  const content = (
    <View
      style={[
        {
          minHeight,
          paddingHorizontal: SPACING.screen,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.card,
          alignSelf: "stretch",
          width: "100%",
        },
        style,
      ]}
    >
      {flattenRowChildren(children)}
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
