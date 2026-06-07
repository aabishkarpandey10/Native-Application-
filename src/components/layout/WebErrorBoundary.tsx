import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Surfaces web runtime errors instead of a blank screen after failed hydration. */
export class WebErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WebErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const isWeb = Platform.OS === "web";
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#0A0A0C",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
            Sydney Transit could not start
          </Text>
          <Text style={{ color: "#A1A1AA", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
            {this.state.error.message}
          </Text>
          <Text
            style={{
              color: "#71717A",
              fontSize: 13,
              textAlign: "center",
              marginTop: 20,
              lineHeight: 20,
            }}
          >
            {isWeb
              ? "Open http://localhost:8085 after `npm run dev`, or rebuild with `npm run build` and serve the `dist` folder. Check the browser console (F12) for details."
              : "Shake the device and tap Reload, or restart `npm run dev`. Ensure your phone and PC are on the same Wi‑Fi and EXPO_PUBLIC_API_URL points to your PC's LAN IP."}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
