import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { HAIRLINE, titleWeight } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "./Txt";

interface NavBarProps {
  title: string;
  /** TripView-style blue header (tab root screens) */
  primary?: boolean;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  below?: ReactNode;
}

/** Top navigation — white grouped style or TripView blue header. */
export function NavBar({ title, primary, subtitle, onBack, right, below }: NavBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const fg = primary ? c.headerText : c.text;
  const backColor = primary ? c.headerText : c.primary;

  return (
    <View
      style={{
        backgroundColor: primary ? c.header : c.card,
        borderBottomWidth: primary ? 0 : HAIRLINE,
        borderBottomColor: c.separator,
        paddingTop: insets.top,
        paddingHorizontal: 16,
        paddingBottom: primary ? 10 : 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={{ marginRight: 4, marginLeft: -8, width: 44, height: 44, justifyContent: "center" }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={28} color={backColor} strokeWidth={2.2} />
          </Pressable>
        ) : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt
            size={17}
            weight={titleWeight()}
            color={fg}
            style={{ letterSpacing: -0.4 }}
          >
            {title}
          </Txt>
          {subtitle ? <View style={{ marginTop: 2 }}>{subtitle}</View> : null}
        </View>

        {right ? <View style={{ flexDirection: "row", alignItems: "center" }}>{right}</View> : null}
      </View>

      {below ? <View style={{ marginTop: 8 }}>{below}</View> : null}
    </View>
  );
}
