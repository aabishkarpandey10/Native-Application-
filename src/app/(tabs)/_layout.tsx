import { Tabs } from "expo-router";
import { View } from "react-native";
import { AppConfigBanner } from "../../components/AppConfigBanner";
import { BackendConnectivityBanner } from "../../components/BackendConnectivityBanner";
import { TripViewTabBar } from "../../components/tripview/TripViewTabBar";
import { useAppFeatures } from "../../hooks/useAppFeatures";

function TabShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <BackendConnectivityBanner />
      <AppConfigBanner />
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const { favourites } = useAppFeatures();

  return (
    <Tabs
      initialRouteName="tools"
      tabBar={(props) => (
        <TripViewTabBar state={props.state} navigation={props.navigation} />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
        lazy: true,
        freezeOnBlur: true,
        sceneStyle: { flex: 1 },
      }}
      screenLayout={({ children }) => <TabShell>{children}</TabShell>}
    >
      <Tabs.Screen name="favourites" />
      <Tabs.Screen name="tools" />
      <Tabs.Screen name="about" />
      <Tabs.Screen name="nearby" options={{ href: null }} />
      <Tabs.Screen name="journey" options={{ href: null }} />
      <Tabs.Screen name="alerts" options={{ href: null }} />
    </Tabs>
  );
}
