import { type ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { TAB_BAR_HEIGHT } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

interface PageProps {
  children: ReactNode;
  scroll?: boolean;
  /** bottom padding to clear the tab bar (default 90) */
  bottomPad?: number;
  contentStyle?: ViewStyle;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refreshControl?: React.ReactElement<any>;
}

/** Page body that sits under a NavBar and fills with the page background. */
export function Page({ children, scroll = true, bottomPad = TAB_BAR_HEIGHT + 24, contentStyle, refreshControl }: PageProps) {
  const c = useColors();
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ paddingBottom: bottomPad }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}
