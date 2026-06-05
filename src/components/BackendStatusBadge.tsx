import { ActivityIndicator, Text, View } from "react-native";
import { useBackendStatus } from "../hooks/useBackendStatus";

export function BackendStatusBadge() {
  const { data, isLoading, isError } = useBackendStatus();

  if (isLoading) {
    return (
      <View className="flex-row items-center gap-1.5 px-2.5 py-2 rounded-xl bg-surface-card border border-surface-border shrink-0">
        <ActivityIndicator size="small" color="#71717A" />
        <Text className="text-zinc-500 text-[10px] font-medium">API</Text>
      </View>
    );
  }

  if (isError || !data || data.ok === false) {
    return (
      <View className="px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 shrink-0">
        <Text className="text-amber-400 text-[10px] font-semibold">Offline</Text>
      </View>
    );
  }

  const live = data.tfnswLive;
  const label = live ? "Live" : data.tfnswConfigured ? "Mock" : "Local";

  return (
    <View
      className={`px-2.5 py-2 rounded-xl border shrink-0 ${
        live
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-surface-card border-surface-border"
      }`}
    >
      <Text
        className={`text-[10px] font-semibold ${live ? "text-emerald-400" : "text-zinc-400"}`}
      >
        {label}
      </Text>
    </View>
  );
}
