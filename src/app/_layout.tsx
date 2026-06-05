import { Platform } from "react-native";
import { enableScreens } from "react-native-screens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import "../global.css";
import { SafeBackHandler } from "../components/SafeBackHandler";
import { RemoteSettingsSync } from "../components/RemoteSettingsSync";
import { AppBootstrap } from "../providers/AppBootstrap";
import { DatabaseProvider } from "../providers/DatabaseProvider";
import { ToastProvider } from "../providers/ToastProvider";
import { useStore } from "../store/store";
import { FEATURES } from "../constants/features";
import { MobileWebShell } from "../components/layout/MobileWebShell";
import { WebErrorBoundary } from "../components/layout/WebErrorBoundary";

enableScreens(true);

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn && !sentryDsn.includes("placeholder")) {
  import("@sentry/react-native").then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, debug: false });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: Platform.OS === "web" ? 2 : 1,
      refetchOnWindowFocus: false,
      staleTime: Platform.OS === "web" ? 0 : 30_000,
    },
  },
});

function RootLayout() {
  const theme = useStore((s) => s.theme);
  const isDark = theme === "dark";

  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <WebErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RemoteSettingsSync />
        <ToastProvider>
          <AppBootstrap>
            <DatabaseProvider>
              <MobileWebShell>
                <StatusBar style={isDark ? "light" : "dark"} />
                <SafeBackHandler />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: isDark ? "#000000" : "#EFEFF4" },
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
                  <Stack.Screen name="trip-results" options={{ presentation: "card" }} />
                  {FEATURES.assistant ? (
                    <Stack.Screen name="assistant" options={{ presentation: "card" }} />
                  ) : null}
                  {FEATURES.admin ? (
                    <Stack.Screen name="admin" options={{ presentation: "card" }} />
                  ) : null}
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
