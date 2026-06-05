import { type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { titleWeight } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";

/** Centered screen title (Tools / Trips / About style). */
export function ScreenTitle({
  title,
  right,
  left,
}: {
  title: string;
  right?: ReactNode;
  left?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: c.bg,
        flexDirection: "row",
        alignItems: "center",
        minHeight: insets.top + 52,
      }}
    >
      <View style={{ width: 72, alignItems: "flex-start" }}>{left}</View>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Txt size={17} weight={titleWeight()} color={c.text}>
          {title}
        </Txt>
      </View>
      <View style={{ width: 72, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
