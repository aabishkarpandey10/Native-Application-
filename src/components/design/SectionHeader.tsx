import { View } from "react-native";
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
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      <Txt size={12} weight="600" color={c.textSecondary} tracking={0.6} uppercase>
        {title}
      </Txt>
      {trailing}
    </View>
  );
}
