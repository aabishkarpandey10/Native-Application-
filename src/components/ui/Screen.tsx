import { ReactNode } from "react";
import { Platform, RefreshControl, ScrollView, View, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { SCREEN_HORIZONTAL_PADDING, STACK_SCROLL_BOTTOM_PADDING, TAB_SCROLL_BOTTOM_PADDING } from "../../constants/layout";
import { useStore } from "../../store/store";

export type ScreenVariant = "tab" | "stack" | "full" | "map";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  variant?: ScreenVariant;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const VARIANT_EDGES: Record<ScreenVariant, Edge[]> = {
  tab: ["top", "left", "right"],
  stack: ["top", "left", "right", "bottom"],
  full: ["top", "left", "right", "bottom"],
  map: ["top", "left", "right"],
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  variant = "tab",
  edges,
  contentStyle,
  refreshing,
  onRefresh,
  className = "",
}: ScreenProps) {
  const isDark = useStore((s) => s.theme) === "dark";
  const bg = isDark ? "#0A0A0C" : "#F4F6FA";
  const resolvedEdges = edges ?? VARIANT_EDGES[variant];
  const bottomPad = variant === "tab" || variant === "map" ? TAB_SCROLL_BOTTOM_PADDING : STACK_SCROLL_BOTTOM_PADDING;
  const horizontalPad = padded ? SCREEN_HORIZONTAL_PADDING : 0;

  const refreshControl =
    onRefresh ? (
      <RefreshControl
        refreshing={!!refreshing}
        onRefresh={onRefresh}
        tintColor={isDark ? "#0A84FF" : "#2563EB"}
        colors={Platform.OS === "android" ? ["#0A84FF"] : undefined}
      />
    ) : undefined;

  if (scroll) {
    return (
      <SafeAreaView className={`flex-1 ${className}`} style={{ backgroundColor: bg }} edges={resolvedEdges}>
        <ScrollView
          className="flex-1"
          style={{ paddingHorizontal: horizontalPad }}
          contentContainerStyle={{
            paddingBottom: bottomPad,
            paddingTop: Platform.OS === "android" ? 4 : 0,
            ...contentStyle,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${className}`} style={{ backgroundColor: bg }} edges={resolvedEdges}>
      <View
        className={`flex-1 ${className}`}
        style={{
          paddingHorizontal: horizontalPad,
          paddingTop: Platform.OS === "android" ? 4 : 0,
          ...contentStyle,
        }}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
