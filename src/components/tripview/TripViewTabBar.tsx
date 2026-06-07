import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Settings, Star } from "lucide-react-native";
import {
  HAIRLINE,
  MIN_TOUCH,
  RADIUS,
  SPACING,
  safeBottomInset,
  tabBarShadow,
} from "../../constants/design";
import { TAB_BAR_FLOAT_GAP, TAB_BAR_PILL_HEIGHT } from "../../constants/layout";
import { useAppFeatures } from "../../hooks/useAppFeatures";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";

interface TabRoute {
  key: string;
  name: string;
}

interface TripViewTabBarProps {
  state: { index: number; routes: TabRoute[] };
  navigation: { navigate: (name: string) => void };
}

const TAB_META: Record<string, { label: string; Icon: typeof Star }> = {
  favourites: { label: "Trips", Icon: Star },
  tools: { label: "Tools", Icon: Settings },
  about: { label: "About", Icon: Info },
};

export function TripViewTabBar({ state, navigation }: TripViewTabBarProps) {
  const c = useColors();
  const { favourites } = useAppFeatures();
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => {
    if (!TAB_META[r.name]) return false;
    if (r.name === "favourites" && !favourites) return false;
    return true;
  });
  const bottomPad = safeBottomInset(insets.bottom);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: bottomPad,
        paddingHorizontal: SPACING.screen,
        minHeight: TAB_BAR_PILL_HEIGHT + bottomPad + TAB_BAR_FLOAT_GAP - 4,
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <View
        style={[
          {
            flexDirection: "row",
            width: "100%",
            backgroundColor: c.barBg,
            borderRadius: RADIUS.pill,
            paddingVertical: 5,
            paddingHorizontal: 5,
            borderWidth: HAIRLINE,
            borderColor: c.border,
            minHeight: 58,
            alignItems: "center",
          },
          tabBarShadow(c.isDark),
        ]}
      >
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === routeIndex;
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const { label, Icon } = meta;
          const color = focused ? "#FFFFFF" : c.textSecondary;
          const iconColor = focused ? "#FFFFFF" : c.textSecondary;

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                minHeight: MIN_TOUCH,
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: RADIUS.pill,
                  width: "100%",
                  backgroundColor: focused ? c.primary : "transparent",
                }}
              >
                <Icon size={20} color={iconColor} strokeWidth={focused ? 2.5 : 2} />
                <Txt size={11} weight={focused ? "600" : "500"} color={color} style={{ marginTop: 3 }}>
                  {label}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
