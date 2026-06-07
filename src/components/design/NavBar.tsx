import { type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cardShadow,
  HAIRLINE,
  HEADER_BODY_MIN_HEIGHT,
  NAV_TITLE_SIZE,
  SPACING,
  headerPaddingTop,
  titleWeight,
} from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { BackButton } from "./BackButton";
import { Txt } from "./Txt";

interface NavBarProps {
  title: string;
  /** Accent top stripe (legacy prop — header stays neutral) */
  primary?: boolean;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  below?: ReactNode;
}

/** Top navigation — neutral card header with optional accent stripe. */
export function NavBar({ title, primary, subtitle, onBack, right, below }: NavBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const top = headerPaddingTop(insets.top);

  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderBottomWidth: HAIRLINE,
          borderBottomColor: c.separator,
          paddingTop: top,
          paddingHorizontal: SPACING.screen,
          paddingBottom: 14,
          overflow: "hidden",
        },
        cardShadow(c.isDark),
      ]}
    >
      {primary ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: c.primary,
          }}
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: HEADER_BODY_MIN_HEIGHT }}>
        {onBack ? (
          <View style={{ marginRight: 10 }}>
            <BackButton onPress={onBack} />
          </View>
        ) : null}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={NAV_TITLE_SIZE} weight={titleWeight()} color={c.text} tracking={-0.4}>
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
