import { Platform, View } from "react-native";
import { Stack } from "expo-router";

const PHONE_WIDTH = 430;

export default function AdminLayout() {
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#000000" },
        animation: Platform.OS === "ios" ? "default" : "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", alignItems: "center" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: PHONE_WIDTH,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: "#38383A",
          }}
        >
          {stack}
        </View>
      </View>
    );
  }

  return stack;
}
