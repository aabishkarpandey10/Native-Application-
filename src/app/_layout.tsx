import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { RemoteSettingsSync } from "../components/RemoteSettingsSync";
import { MobileWebShell } from "../components/layout/MobileWebShell";
import { WebErrorBoundary } from "../components/layout/WebErrorBoundary";
import { PALETTE } from "../constants/design";
import { setInterFontsAvailable } from "../constants/typography";
import "../global.css";
import { AppBootstrap } from "../providers/AppBootstrap";
import { DatabaseProvider } from "../providers/DatabaseProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { useStore } from "../store/store";

enableScreens(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  },
});

function RootLayout() {
  const theme = useStore((s) => s.theme);
  const isDark = theme === "dark";
  const palette = PALETTE[isDark ? "dark" : "light"];

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) setInterFontsAvailable(true);
    if (fontError) {
      console.warn("[fonts] Inter failed to load; using system fonts", fontError);
      setInterFontsAvailable(false);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void SystemUI.setBackgroundColorAsync(palette.bg);
  }, [palette.bg]);

  const ready = fontsLoaded || fontError != null;

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  return (
    <WebErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <RemoteSettingsSync />
          <ToastProvider>
            <AppBootstrap>
              <DatabaseProvider>
                <MobileWebShell>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: palette.bg },
                      animation: "slide_from_right",
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="departures" options={{ presentation: "card" }} />
                    <Stack.Screen name="map" options={{ presentation: "card" }} />
                    <Stack.Screen name="station/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="settings" options={{ presentation: "card" }} />
                    <Stack.Screen name="alarms" options={{ presentation: "card" }} />
                    <Stack.Screen name="alarm-editor" options={{ presentation: "card" }} />
                    <Stack.Screen name="watch-settings" options={{ presentation: "card" }} />
                    <Stack.Screen
                      name="new-trip"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                        gestureEnabled: true,
                      }}
                    />
                    <Stack.Screen name="station-picker" options={{ presentation: "card" }} />
                    <Stack.Screen name="bus-route-picker" options={{ presentation: "card" }} />
                    <Stack.Screen name="trip-results" options={{ presentation: "card" }} />
                    <Stack.Screen name="assistant" options={{ presentation: "card" }} />
                    <Stack.Screen name="admin" options={{ presentation: "card" }} />
                    <Stack.Screen name="alerts" options={{ presentation: "card" }} />
                  </Stack>
                </MobileWebShell>
              </DatabaseProvider>
            </AppBootstrap>
          </ToastProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </WebErrorBoundary>
  );
}

export default RootLayout;
