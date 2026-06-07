import { type ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStackContentClearance, getTabBarContentClearance } from "../../constants/layout";
import { useColors } from "../../hooks/useColors";

interface PageProps {
  children: ReactNode;
  scroll?: boolean;
  /** When true, pads for the floating tab bar (tab screens only). */
  tabScreen?: boolean;
  /** Override computed bottom padding. */
  bottomPad?: number;
  contentStyle?: ViewStyle;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refreshControl?: React.ReactElement<any>;
}

/** Scrollable page body under a header — auto bottom clearance for tab vs stack screens. */
export function Page({
  children,
  scroll = true,
  tabScreen = false,
  bottomPad,
  contentStyle,
  refreshControl,
}: PageProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const resolvedBottomPad =
    bottomPad ??
    (tabScreen ? getTabBarContentClearance(insets.bottom) : getStackContentClearance(insets.bottom));

  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ paddingBottom: resolvedBottomPad }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}
