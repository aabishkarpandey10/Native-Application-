import { Platform } from "react-native";
import { Stack } from "expo-router";
import { PALETTE } from "../../constants/design";
import { useStore } from "../../store/store";

export default function AdminLayout() {
  const isDark = useStore((s) => s.theme) === "dark";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: PALETTE[isDark ? "dark" : "light"].bg },
        animation: Platform.OS === "ios" ? "default" : "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
