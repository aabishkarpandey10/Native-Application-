import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { SPACING } from "../constants/design";
import { getApiConfigReport } from "../config/api";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { useColors } from "../hooks/useColors";
import { Txt } from "./design/Txt";

/** Shown on main tabs when the Express API is unreachable (common in misconfigured release builds). */
export function BackendConnectivityBanner() {
  const c = useColors();
  const router = useRouter();
  const { data: status, isLoading, isError, error } = useBackendStatus();
  const report = getApiConfigReport();

  if (isLoading) return null;
  if (!isError && status?.ok) return null;

  const configIssue = report.issues[0];
  const networkMessage =
    error instanceof Error ? error.message : isError ? "Network request failed" : null;
  const message =
    configIssue ??
    networkMessage ??
    "Cannot reach the Sydney Transit API. Live departures and admin settings are unavailable.";

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/about" as never)}
      accessibilityRole="button"
      accessibilityLabel="API connection help"
      style={{
        backgroundColor: c.isDark ? "#3B2F1A" : "#FFFBEB",
        borderBottomWidth: 1,
        borderBottomColor: c.isDark ? "#92400E" : "#FDE68A",
        paddingHorizontal: SPACING.screen,
        paddingVertical: 10,
      }}
    >
      <Txt size={13} weight="600" color={c.isDark ? "#FBBF24" : "#92400E"}>
        API offline
      </Txt>
      <Txt size={12} color={c.textSecondary} style={{ marginTop: 3, lineHeight: 17 }}>
        {message}
      </Txt>
      <Txt size={11} color={c.textSecondary} style={{ marginTop: 4 }} numberOfLines={2}>
        Target: {report.resolvedUrl}
        {!report.isDev ? " · release build (Expo Go LAN rewrite disabled)" : ""}
      </Txt>
    </Pressable>
  );
}
