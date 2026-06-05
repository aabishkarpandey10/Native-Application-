import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { AppConfigBanner } from "../../components/AppConfigBanner";
import { TripViewTabBar } from "../../components/tripview/TripViewTabBar";

export default function TabsLayout() {
  return (
    <>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <AppConfigBanner />
        <Tabs
          initialRouteName="favourites"
          tabBar={(props) => (
            <TripViewTabBar
              state={props.state}
              navigation={props.navigation}
            />
          )}
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
            lazy: true,
            freezeOnBlur: true,
          }}
        >
          <Tabs.Screen name="favourites" />
          <Tabs.Screen name="tools" />
          <Tabs.Screen name="about" />
          <Tabs.Screen name="nearby" options={{ href: null }} />
          <Tabs.Screen name="journey" options={{ href: null }} />
          <Tabs.Screen name="alerts" options={{ href: null }} />
        </Tabs>
      </View>
    </>
  );
}
