import { ActivityIndicator, View } from "react-native";
import { RADIUS, SEMANTIC } from "../constants/design";
import { useColors } from "../hooks/useColors";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { Txt } from "./design/Txt";

export function BackendStatusBadge() {
  const c = useColors();
  const { data, isLoading, isError } = useBackendStatus();

  if (isLoading) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: RADIUS.card,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
          flexShrink: 0,
        }}
      >
        <ActivityIndicator size="small" color={c.textSecondary} />
        <Txt size={10} weight="500" color={c.textSecondary}>
          API
        </Txt>
      </View>
    );
  }

  if (isError || !data || data.ok === false) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: RADIUS.card,
          backgroundColor: c.isDark ? "#3B2F1A" : "#FFFBEB",
          borderWidth: 1,
          borderColor: c.isDark ? "#92400E" : "#FDE68A",
          flexShrink: 0,
        }}
      >
        <Txt size={10} weight="600" color={SEMANTIC.warning}>
          Offline
        </Txt>
      </View>
    );
  }

  const live = data.tfnswLive;
  const label = live
    ? "Live"
    : data.tfnswConfigured
      ? "Scheduled"
      : data.dataSource === "mock"
        ? "Demo"
        : "Offline";

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: RADIUS.card,
        borderWidth: 1,
        flexShrink: 0,
        backgroundColor: live ? (c.isDark ? "#1A2E22" : "#ECFDF3") : c.card,
        borderColor: live ? (c.isDark ? "#166534" : "#BBF7D0") : c.border,
      }}
    >
      <Txt size={10} weight="600" color={live ? SEMANTIC.success : c.textSecondary}>
        {label}
      </Txt>
    </View>
  );
}
