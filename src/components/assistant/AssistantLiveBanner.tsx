import { RefreshCw, Radio } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { LivePulse } from "../ui/LivePulse";
import { formatLiveAsOf, countActiveAlerts } from "../../utils/assistantLiveSummary";
import type { AssistantLiveBoard } from "../../types/assistantLive";

type Props = {
  board: AssistantLiveBoard | null | undefined;
  isFetching?: boolean;
  onRefresh?: () => void;
  lastResponseSource?: string | null;
  compact?: boolean;
};

export function AssistantLiveBanner({
  board,
  isFetching,
  onRefresh,
  lastResponseSource,
  compact,
}: Props) {
  const isLive = board?.tfnswLive ?? false;
  const pulseColor = isLive ? "#30D158" : "#FF9F0A";
  const alertCount = countActiveAlerts(board);
  const updated = formatLiveAsOf(board?.asOf);

  return (
    <View
      className={`rounded-2xl border mb-3 overflow-hidden ${
        isLive
          ? "bg-[#30D158]/8 border-[#30D158]/25"
          : "bg-amber-500/8 border-amber-500/25"
      }`}
    >
      <View className="flex-row items-center px-4 py-3 gap-3">
        <LivePulse color={pulseColor} size={compact ? 5 : 6} />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Radio size={14} color={pulseColor} />
            <Text className="text-white font-bold text-sm">
              {isLive ? "Real-time TfNSW" : "Scheduled data"}
            </Text>
          </View>
          <Text className="text-zinc-400 text-[11px] mt-0.5 leading-4">
            {updated ? `Boards updated ${updated}` : "Fetching live boards…"}
            {board?.dataSource ? ` · ${board.dataSource}` : ""}
            {alertCount > 0 ? ` · ${alertCount} alert${alertCount > 1 ? "s" : ""}` : ""}
          </Text>
          {lastResponseSource && !compact ? (
            <Text className="text-zinc-500 text-[10px] mt-1">
              Last reply source: {lastResponseSource.replace(/-/g, " ")}
            </Text>
          ) : null}
        </View>
        {onRefresh ? (
          <Pressable
            onPress={onRefresh}
            disabled={isFetching}
            className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-surface-card border border-surface-border"
          >
            <RefreshCw size={14} color="#0A84FF" />
            <Text className="text-brand-primary text-xs font-semibold">
              {isFetching ? "…" : "Sync"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {isFetching ? (
        <View className="px-4 pb-2">
          <Text className="text-brand-primary text-[10px] font-medium">
            Syncing departures & alerts for your question…
          </Text>
        </View>
      ) : null}
    </View>
  );
}
