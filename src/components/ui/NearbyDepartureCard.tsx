import { Pressable, Text, View } from "react-native";
import ModeBadge from "../ModeBadge";
import { getRouteBadgeStyle } from "../../utils/transitColors";
import type { Departure } from "../../services/tfnsw";
import { minutesUntil } from "../../utils/tfnswTime";

interface NearbyDepartureCardProps {
  departure: Departure;
  onPress?: () => void;
}

function countdownColor(minutes: number, delayed: boolean) {
  if (delayed) return "#FF453A";
  if (minutes <= 0) return "#FF453A";
  if (minutes <= 5) return "#30D158";
  if (minutes <= 10) return "#FF9F0A";
  return "#30D158";
}

export function NearbyDepartureCard({ departure, onPress }: NearbyDepartureCardProps) {
  const mins = minutesUntil(departure.departureTime);
  const delayed = (departure.delayMinutes ?? 0) > 0;
  const label = mins <= 0 ? "Now" : `${mins} min`;
  const color = countdownColor(mins, delayed);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      className="flex-row items-center bg-surface-card border border-surface-border rounded-2xl p-4 mb-2.5"
    >
      <ModeBadge mode={departure.mode} size="md" badgeClassName="mr-2.5" />
      {departure.routeNumber && departure.routeNumber !== "—" ? (
        <View
          className="px-2 py-1 rounded-lg mr-2 items-center justify-center min-w-[32px]"
          style={getRouteBadgeStyle(departure.mode, departure.routeNumber, departure.lineColor)}
        >
          <Text className="text-white text-[10px] font-black">{departure.routeNumber}</Text>
        </View>
      ) : null}
      <View className="flex-1 min-w-0">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {departure.destination}
        </Text>
        <Text className="text-zinc-500 text-xs mt-0.5 capitalize">{departure.mode}</Text>
      </View>
      <Text className="text-base font-bold ml-2" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
