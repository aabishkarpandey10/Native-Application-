import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Settings, Star } from "lucide-react-native";
import { HAIRLINE, MIN_TOUCH, TAB_BAR_HEIGHT } from "../../constants/design";
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
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r) => TAB_META[r.name]);
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: bottomPad,
        paddingHorizontal: 20,
        minHeight: TAB_BAR_HEIGHT + bottomPad + 12,
        justifyContent: "flex-end",
        alignItems: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          maxWidth: 400,
          backgroundColor: c.isDark ? "rgba(44,44,46,0.96)" : "rgba(255,255,255,0.96)",
          borderRadius: 28,
          paddingVertical: 6,
          paddingHorizontal: 6,
          borderWidth: HAIRLINE,
          borderColor: c.separator,
          minHeight: 56,
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: c.isDark ? 0.45 : 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === routeIndex;
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const { label, Icon } = meta;
          const color = focused ? c.primary : c.textSecondary;

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
                paddingHorizontal: 8,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 4,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  backgroundColor: focused
                    ? c.isDark
                      ? "rgba(58,58,60,0.95)"
                      : "rgba(0,0,0,0.06)"
                    : "transparent",
                }}
              >
                <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
                <Txt size={11} weight="500" color={color} style={{ marginTop: 2 }}>
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
