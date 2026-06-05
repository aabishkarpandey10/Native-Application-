import React from "react";
import { View, Text } from "react-native";
import { Departure } from "../services/tfnsw";
import ModeBadge from "./ModeBadge";
import { formatSydneyTime, minutesUntil, parseTfnswTime } from "../utils/tfnswTime";
import { getRouteBadgeStyle } from "../utils/transitColors";

interface DepartureRowProps {
  departure: Departure;
  showMode?: boolean;
}

function countdownLabel(sched: Date, real: Date) {
  const mins = minutesUntil(real);
  if (mins <= 0) return "Now";
  if (mins === 1) return "1 min";
  if (mins < 60) return `${mins} min`;
  return formatSydneyTime(real);
}

export function DepartureRow({ departure, showMode = false }: DepartureRowProps) {
  const schedTime = parseTfnswTime(departure.scheduledTime ?? departure.departureTime);
  const realTime = parseTfnswTime(
    departure.realTime ?? departure.departureTime ?? departure.scheduledTime
  );
  const countdown = countdownLabel(schedTime, realTime);
  const isDelayed = (departure.delayMinutes ?? 0) > 0;
  const timesDiffer = Math.abs(realTime.getTime() - schedTime.getTime()) >= 60 * 1000;

  return (
    <View className="flex-row items-center justify-between py-3.5 border-b border-zinc-800/80">
      <View className="flex-row items-center flex-1 pr-3">
        {showMode && (
          <View className="mr-3">
            <ModeBadge mode={departure.mode} size="sm" />
          </View>
        )}

        <View
          className="px-2.5 py-1 rounded-lg mr-3.5 items-center justify-center min-w-[40px] shadow-sm shadow-black/40"
          style={getRouteBadgeStyle(
            departure.mode,
            departure.routeNumber,
            departure.lineColor
          )}
        >
          <Text className="text-white text-xs font-black tracking-tight">{departure.routeNumber}</Text>
        </View>

        <View className="flex-1">
          <Text className="text-zinc-100 font-bold text-sm tracking-tight" numberOfLines={1}>
            {departure.destination}
          </Text>
          <View className="flex-row items-center mt-1 flex-wrap">
            {departure.platform ? (
              <View className="bg-zinc-800 px-1.5 py-0.5 rounded-md mr-2">
                <Text className="text-zinc-400 text-[10px] font-bold">
                  Platform {departure.platform}
                </Text>
              </View>
            ) : null}
            <Text className="text-zinc-400 text-[10px] font-medium">
              {timesDiffer
                ? `Est ${formatSydneyTime(realTime)} · Sched ${formatSydneyTime(schedTime)}`
                : `Departs ${formatSydneyTime(realTime)}`}
            </Text>
          </View>
        </View>
      </View>

      <View className="items-end">
        <Text
          className={`text-base font-black tracking-tight ${
            countdown === "Now" ? "text-[#30D158]" : "text-zinc-50"
          }`}
        >
          {countdown}
        </Text>

        {isDelayed ? (
          <View className="bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full mt-1.5">
            <Text className="text-rose-400 text-[9px] font-extrabold uppercase tracking-wide">
              +{departure.delayMinutes}m delay
            </Text>
          </View>
        ) : (
          <View className="bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded-full mt-1.5">
            <Text className="text-[#30D158] text-[9px] font-extrabold uppercase tracking-wide">
              On Time
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default DepartureRow;
