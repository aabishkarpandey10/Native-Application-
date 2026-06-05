import { ActivityIndicator, Pressable, Text, View } from "react-native";
import ModeBadge from "../ModeBadge";
import { LIVE_MODE_ORDER, type AssistantLiveBoard } from "../../types/assistantLive";
import { getRouteHexColor } from "../../utils/transitColors";

type Props = {
  board: AssistantLiveBoard | null | undefined;
  loading?: boolean;
  onRefresh?: () => void;
  onAskMode?: (prompt: string) => void;
};

function formatAsOf(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function LiveModeSections({ board, loading, onRefresh, onAskMode }: Props) {
  if (loading && !board) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator color="#0A84FF" />
        <Text className="text-zinc-500 text-sm mt-2">Loading live boards…</Text>
      </View>
    );
  }

  if (!board) return null;

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="text-white font-semibold text-base">Live departures</Text>
          <Text className="text-zinc-500 text-xs mt-0.5">
            Updated {formatAsOf(board.asOf)} · {board.dataSource}
          </Text>
        </View>
        {onRefresh ? (
          <Pressable onPress={onRefresh} className="px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border">
            <Text className="text-brand-primary text-xs font-semibold">Refresh</Text>
          </Pressable>
        ) : null}
      </View>

      {LIVE_MODE_ORDER.map(({ key, mode, label }) => {
        const section = board.byMode?.[key];
        const alerts = board.alertsByMode?.[key] ?? [];
        const stops = section?.stops ?? [];

        return (
          <View
            key={key}
            className="mb-3 rounded-2xl bg-surface-card border border-surface-border overflow-hidden"
          >
            <Pressable
              onPress={() => onAskMode?.(`What's the next ${label.toLowerCase()} departure near me?`)}
              className="flex-row items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-elevated/40"
            >
              <View className="flex-row items-center gap-2.5">
                <ModeBadge mode={mode} size="sm" />
                <Text className="text-white font-semibold text-sm">{label}</Text>
              </View>
              {alerts.length > 0 ? (
                <View className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
                  <Text className="text-amber-400 text-[10px] font-semibold">{alerts.length} alert</Text>
                </View>
              ) : null}
            </Pressable>

            {alerts.slice(0, 1).map((a) => (
              <View key={a.title} className="px-4 py-2 bg-amber-500/5 border-b border-surface-border">
                <Text className="text-amber-200/90 text-xs" numberOfLines={2}>
                  {a.title}
                </Text>
              </View>
            ))}

            {stops.length === 0 ? (
              <Text className="text-zinc-500 text-xs px-4 py-3">No stops in range for this mode.</Text>
            ) : (
              stops.map((stop) => (
                <View key={stop.station_id} className="px-4 py-3 border-b border-surface-border/60 last:border-b-0">
                  <Text className="text-zinc-400 text-[11px] mb-1.5">
                    {stop.station_name}
                    {stop.distance_meters != null ? ` · ${stop.distance_meters}m` : ""}
                  </Text>
                  {stop.next_departures.length === 0 ? (
                    <Text className="text-zinc-600 text-xs">No departures listed</Text>
                  ) : (
                    stop.next_departures.map((dep, i) => (
                      <View key={`${dep.route}-${i}`} className="flex-row items-center gap-2 mb-1">
                        <View
                          className="w-1 h-4 rounded-full"
                          style={{ backgroundColor: getRouteHexColor(mode, dep.route) }}
                        />
                        <Text className="text-zinc-200 text-xs flex-1" numberOfLines={1}>
                          <Text className="font-bold text-white">{dep.route}</Text> → {dep.destination}
                        </Text>
                        <Text
                          className={`text-xs font-semibold ${
                            dep.delayMinutes > 0 ? "text-amber-400" : "text-brand-primary"
                          }`}
                        >
                          {dep.label}
                          {dep.delayMinutes > 0 ? ` +${dep.delayMinutes}m` : ""}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
