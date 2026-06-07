import { Accessibility, ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Departure } from "../../services/tfnsw";
import ModeBadge from "../ModeBadge";
import { formatSydneyTime, minutesUntil, parseTfnswTime } from "../../utils/tfnswTime";
import { getRouteBadgeStyle, getRouteHexColor } from "../../utils/transitColors";

interface LiveDepartureCardProps {
  departure: Departure;
}

function statusColor(mins: number, delayed: boolean) {
  if (delayed || mins <= 0) return "#FF453A";
  if (mins <= 5) return "#FF9F0A";
  return "#30D158";
}

export function LiveDepartureCard({ departure }: LiveDepartureCardProps) {
  const [expanded, setExpanded] = useState(false);
  const mins = minutesUntil(departure.departureTime);
  const delayed = (departure.delayMinutes ?? 0) > 0;
  const label = mins <= 0 ? "Now" : `${mins} min`;
  const color = statusColor(mins, delayed);
  const routeColor = getRouteHexColor(departure.mode, departure.routeNumber, departure.lineColor);
  const progress = mins <= 0 ? 0.95 : Math.max(0.15, 1 - mins / 20);

  return (
    <View className="bg-surface-card border border-surface-border rounded-2xl mb-3 overflow-hidden">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
        className="p-4"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1 pr-3">
            <ModeBadge mode={departure.mode} size="md" style={{ marginRight: 10 }} />
            {departure.routeNumber && departure.routeNumber !== "—" ? (
              <View
                className="px-2 py-1 rounded-lg mr-2.5 items-center justify-center min-w-[36px]"
                style={getRouteBadgeStyle(departure.mode, departure.routeNumber, departure.lineColor)}
              >
                <Text className="text-white text-[10px] font-black">{departure.routeNumber}</Text>
              </View>
            ) : null}
            <View className="flex-1">
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {departure.destination}
              </Text>
              <View className="flex-row items-center gap-2 mt-1.5 flex-wrap">
                {departure.platform ? (
                  <Text className="text-zinc-500 text-[11px] font-medium">
                    Platform {departure.platform}
                  </Text>
                ) : null}
                <Text className="text-zinc-600 text-[11px]">·</Text>
                <Text className="text-zinc-500 text-[11px]">8 cars</Text>
                <Accessibility size={12} color="#71717A" />
              </View>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold" style={{ color }}>
              {label}
            </Text>
            {expanded ? (
              <ChevronUp size={14} color="#71717A" style={{ marginTop: 4 }} />
            ) : (
              <ChevronDown size={14} color="#71717A" style={{ marginTop: 4 }} />
            )}
          </View>
        </View>

        <View className="h-1 bg-surface-elevated rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: routeColor,
            }}
          />
          <View
            className="absolute w-2.5 h-2.5 rounded-full -top-[3px]"
            style={{
              left: `${Math.min(progress * 100, 98)}%`,
              backgroundColor: routeColor,
              marginLeft: -5,
            }}
          />
        </View>
      </Pressable>

      {expanded && departure.stops && departure.stops.length > 0 ? (
        <View className="px-4 pb-4 pt-1 border-t border-surface-border">
          {departure.stops.slice(0, 6).map((stop, idx) => {
            const stopTime = parseTfnswTime(stop.time);
            return (
              <View key={idx} className="flex-row justify-between py-2">
                <Text className="text-zinc-300 text-xs flex-1">{stop.station_name}</Text>
                <Text className="text-zinc-500 text-xs">{formatSydneyTime(stopTime)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
