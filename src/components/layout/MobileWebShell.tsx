import { type ReactNode } from "react";
import { Platform, View } from "react-native";
import { APP_SHELL_WIDTH, HAIRLINE } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { useWebDocumentTheme } from "../../hooks/useWebDocumentTheme";

/** Centers content in a fixed-width column — same frame on web and native (phones use full width). */
export function MobileWebShell({ children }: { children: ReactNode }) {
  const c = useColors();
  const showSideBorders = Platform.OS === "web";
  useWebDocumentTheme();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: APP_SHELL_WIDTH,
          alignSelf: "center",
          backgroundColor: c.bg,
          overflow: "hidden",
          borderLeftWidth: showSideBorders ? HAIRLINE : 0,
          borderRightWidth: showSideBorders ? HAIRLINE : 0,
          borderColor: c.separator,
        }}
      >
        {children}
      </View>
    </View>
  );
}

