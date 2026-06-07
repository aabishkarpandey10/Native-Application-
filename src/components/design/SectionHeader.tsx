import { View } from "react-native";
import { SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "./Txt";

interface SectionHeaderProps {
  title: string;
  /** optional trailing element (e.g. a count or action) */
  trailing?: React.ReactNode;
}

/** Uppercase muted section label over the page background. */
export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        paddingHorizontal: SPACING.screen,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      <Txt size={15} weight="600" color={c.text} tracking={-0.2}>
        {title}
      </Txt>
      {trailing}
    </View>
  );
}
