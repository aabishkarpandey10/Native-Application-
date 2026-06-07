import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HEADER_SIDE_WIDTH, SCHEDULE_TITLE_SIZE, SPACING, titleWeight } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";

type ScreenTitleAlign = "center" | "start";

/** TripView screen header — Tools / Trips / stack screens. */
export function ScreenTitle({
  title,
  subtitle,
  center,
  right,
  left,
  below,
  align = "center",
  live,
}: {
  title?: string;
  subtitle?: string;
  center?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  below?: ReactNode;
  align?: ScreenTitleAlign;
  live?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const titleSize = align === "start" ? SCHEDULE_TITLE_SIZE : 17;

  const titleBlock = center ?? (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start", minWidth: 0 }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
          <Txt size={titleSize} weight={titleWeight()} color={c.text} numberOfLines={1}>
            {title}
          </Txt>
          {live ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: `${c.primary}22`,
                flexShrink: 0,
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
              <Txt size={11} weight="600" color={c.primary}>
                Live
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}
      {subtitle ? (
        <Txt size={13} color={c.textSecondary} style={{ marginTop: 4 }} numberOfLines={2}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: SPACING.screen,
        paddingBottom: below ? 10 : 12,
        backgroundColor: c.bg,
        minHeight: insets.top + 52,
      }}
    >
      {align === "start" ? (
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52 }}>
          {left ? <View style={{ marginRight: 4, flexShrink: 0 }}>{left}</View> : null}
          <View style={{ flex: 1, minWidth: 0 }}>{titleBlock}</View>
          {right ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
              {right}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52 }}>
          <View style={{ width: HEADER_SIDE_WIDTH, alignItems: "flex-start", justifyContent: "center" }}>
            {left}
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minWidth: 0 }}>
            {titleBlock}
          </View>
          <View style={{ width: HEADER_SIDE_WIDTH, alignItems: "flex-end", justifyContent: "center" }}>
            {right}
          </View>
        </View>
      )}

      {below ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        >
          {below}
        </ScrollView>
      ) : null}
    </View>
  );
}
