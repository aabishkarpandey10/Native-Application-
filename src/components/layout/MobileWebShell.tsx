import { type ReactNode } from "react";
import { Platform, View } from "react-native";
import { useColors } from "../../hooks/useColors";

/** Centers content in a 430px column — same frame on web and native (phones use full width). */
export function MobileWebShell({ children }: { children: ReactNode }) {
  const c = useColors();
  const showSideBorders = Platform.OS === "web";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 430,
          alignSelf: "center",
          backgroundColor: c.bg,
          borderLeftWidth: showSideBorders ? 1 : 0,
          borderRightWidth: showSideBorders ? 1 : 0,
          borderColor: c.separator,
        }}
      >
        {children}
      </View>
    </View>
  );
}

