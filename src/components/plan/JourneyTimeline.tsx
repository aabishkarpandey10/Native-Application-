import { Text, View } from "react-native";
import ModeBadge from "../ModeBadge";
import { getTrainLine } from "../../constants/trainNetworks";
import { getModeColor } from "../../constants/transportModes";
import type { TripItinerary, TripLeg } from "../../services/tfnsw";
import { buildLegTimetable, waitMinutesBetween } from "../../utils/legStopTimes";
import { formatSydneyTime } from "../../utils/tfnswTime";
import { getRouteHexColor } from "../../utils/transitColors";

export type TimelineStop = {
  id: string;
  name: string;
  time: Date;
  dotColor: string;
  segmentColor: string;
  timeLabel: string;
  isDestination: boolean;
  detailParts: DetailPart[];
};

type DetailPart = { text: string; color?: string; bold?: boolean };

function cleanStopName(name: string) {
  return name
    .replace(/, Sydney.*$/i, "")
    .replace(/\s+Station$/i, "")
    .replace(/\s*,\s*Stand\s+[A-Z0-9]+.*$/i, "")
    .replace(/\s*,\s*Platform\s+\d+.*$/i, "")
    .trim();
}

function shortTime(date: Date) {
  return formatSydneyTime(date, { hour: "numeric", minute: "2-digit" }).replace(
    /\s*(AM|PM)$/i,
    ""
  );
}

function fullTime(date: Date) {
  return formatSydneyTime(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

function routeLabel(leg: TripLeg): string {
  const route = leg.routeNumber || "";
  if (leg.mode === "train") {
    const line = getTrainLine(route);
    if (line) {
      const short = line.name.replace(/^T\d+\s+/i, "").split(" & ")[0];
      return `${route} ${short}`;
    }
    return route || "Train";
  }
  if (leg.mode === "ferry") {
    if (route === "F1") return "F1 Manly Ferry";
    return route ? `${route} Ferry` : "Ferry";
  }
  if (leg.mode === "metro") return route ? `${route} Metro` : "Metro";
  if (leg.mode === "bus") return route && route !== "-" ? `Bus ${route}` : "Bus";
  if (leg.mode === "light_rail") return route ? `${route} Light Rail` : "Light Rail";
  return route || leg.mode;
}

function legColor(leg: TripLeg | undefined, fallback = "#0A84FF") {
  if (!leg || leg.mode === "walk") return fallback;
  return getRouteHexColor(leg.mode, leg.routeNumber);
}

function formatPlatform(platform?: string, mode?: string) {
  if (!platform) return null;
  const p = platform.trim();
  if (!p || p === "-" || p === "—") return null;
  if (mode === "light_rail" || mode === "lightrail") return null;
  if (/platform|wharf|stand/i.test(p)) return p;
  if (mode === "ferry") return `Wharf ${p}`;
  if (mode === "train" || mode === "metro") return `Platform ${p}`;
  return p;
}

function WalkRow({ leg }: { leg: TripLeg }) {
  return (
    <View className="flex-row items-center py-2 pl-1">
      <View className="w-7 h-7 rounded-full bg-zinc-700 items-center justify-center mr-3">
        <Text className="text-zinc-300 text-[10px] font-bold">W</Text>
      </View>
      <View className="flex-1">
        <Text className="text-zinc-400 text-xs">
          Walk {leg.duration} min
          {leg.destinationName ? ` · ${cleanStopName(leg.destinationName)}` : ""}
        </Text>
      </View>
      <Text className="text-zinc-600 text-xs">{shortTime(leg.departure)}</Text>
    </View>
  );
}

function WaitRow({ minutes }: { minutes: number }) {
  return (
    <View className="flex-row items-center py-1.5 ml-3 border-l border-dashed border-zinc-600 pl-4 my-0.5">
      <Text className="text-zinc-500 text-[11px] font-medium">Wait {minutes} min · Change</Text>
    </View>
  );
}

function TransferInfoRow({
  station,
  alightPlatform,
  boardPlatform,
}: {
  station?: string;
  alightPlatform?: string | null;
  boardPlatform?: string | null;
}) {
  const parts = [
    station ? `Change at ${cleanStopName(station)}` : "Change",
    alightPlatform ? `alight ${alightPlatform}` : null,
    boardPlatform ? `board ${boardPlatform}` : null,
  ].filter(Boolean);
  return (
    <View className="ml-3 border-l border-dashed border-zinc-600 pl-4 pb-1">
      <Text className="text-zinc-500 text-[11px]">{parts.join(" · ")}</Text>
    </View>
  );
}

function LegTimetableRows({ leg, color }: { leg: TripLeg; color: string }) {
  const allRows = buildLegTimetable(leg);
  const rows = allRows;
  if (rows.length <= 2) return null;

  return (
    <View className="mt-2 ml-10 border-l-2 pl-3" style={{ borderColor: `${color}55` }}>
      {rows.map((row, idx) => (
        <View key={`${row.name}-${idx}`} className="flex-row items-center justify-between py-1">
          <Text
            className={`text-xs flex-1 pr-2 ${row.name.startsWith("+") ? "text-zinc-600 italic" : "text-zinc-400"}`}
            numberOfLines={1}
          >
            {row.name}
          </Text>
          {!row.name.startsWith("+") ? (
            <Text className="text-zinc-600 text-[11px] font-medium">{shortTime(row.time)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function TransitLegBlock({
  leg,
  isLast,
  destinationName,
}: {
  leg: TripLeg;
  isLast: boolean;
  destinationName?: string;
}) {
  const color = legColor(leg);
  const label = routeLabel(leg);
  const platform = formatPlatform(leg.platform, leg.mode);
  const endName = isLast
    ? cleanStopName(destinationName || leg.destinationName || leg.stops.at(-1) || "Destination")
    : cleanStopName(leg.destinationName || leg.stops.at(-1) || "Stop");

  return (
    <View className="py-2">
      <View className="flex-row items-start">
        <ModeBadge mode={leg.mode} size="md" style={{ marginRight: 12, marginTop: 2 }} />
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center flex-wrap gap-x-1">
            <Text className="text-white text-sm font-bold" style={{ color }}>
              {label}
            </Text>
            <Text className="text-zinc-600 text-xs">·</Text>
            <Text className="text-zinc-400 text-xs">{leg.duration} min</Text>
          </View>
          <Text className="text-zinc-500 text-xs mt-1">
            Board {fullTime(leg.departure)}
            {platform ? ` · ${platform}` : ""}
          </Text>
          {!isLast ? (
            <Text className="text-zinc-500 text-xs mt-0.5">
              Arrive {fullTime(leg.arrival)} · {endName}
            </Text>
          ) : null}
        </View>
        <Text className="text-zinc-500 text-sm font-medium">{shortTime(leg.departure)}</Text>
      </View>
      <LegTimetableRows leg={leg} color={color} />
    </View>
  );
}

export function buildTimelineStops(
  itinerary: TripItinerary,
  originName?: string,
  destinationName?: string
): TimelineStop[] {
  const { legs, duration, arrivalTime } = itinerary;
  if (!legs.length) return [];

  const stops: TimelineStop[] = [];
  const origin = cleanStopName(
    originName || legs[0].originName || legs[0].stops[0] || "Origin"
  );

  stops.push({
    id: "origin",
    name: origin,
    time: legs[0].departure,
    dotColor: getModeColor("train"),
    segmentColor: legColor(legs.find((l) => l.mode !== "walk")),
    timeLabel: shortTime(legs[0].departure),
    isDestination: false,
    detailParts: [{ text: `Depart ${fullTime(legs[0].departure)}` }],
  });

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.mode === "walk") continue;

    const isLast =
      i === legs.length - 1 || !legs.slice(i + 1).some((l) => l.mode !== "walk");
    const endName = isLast
      ? cleanStopName(destinationName || leg.destinationName || leg.stops.at(-1) || "Destination")
      : cleanStopName(leg.destinationName || leg.stops.at(-1) || "Stop");

    if (isLast) {
      stops.push({
        id: "destination",
        name: endName,
        time: leg.arrival,
        dotColor: "#30D158",
        segmentColor: "#30D158",
        timeLabel: shortTime(leg.arrival),
        isDestination: true,
        detailParts: [
          {
            text: `Arrive ${fullTime(arrivalTime ?? leg.arrival)} · ${duration} min total`,
            color: "#30D158",
          },
        ],
      });
    }
  }

  return stops;
}

type Props = {
  itinerary: TripItinerary;
  originName?: string;
  destinationName?: string;
};

export function JourneyTimeline({ itinerary, originName, destinationName }: Props) {
  const { legs, duration, departureTime, arrivalTime } = itinerary;
  if (!legs.length) return null;

  const transitLegs = legs.filter((l) => l.mode !== "walk");
  const origin = cleanStopName(originName || legs[0].originName || legs[0].stops[0] || "Origin");
  const destination = cleanStopName(
    destinationName ||
      transitLegs.at(-1)?.destinationName ||
      transitLegs.at(-1)?.stops.at(-1) ||
      "Destination"
  );

  return (
    <View className="bg-[#262626] rounded-2xl p-4 mt-3">
      <Text className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">
        Journey timeline
      </Text>

      <View className="flex-row items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-2.5 mb-3">
        <View>
          <Text className="text-zinc-500 text-[10px] uppercase font-semibold">Depart</Text>
          <Text className="text-white text-sm font-bold">{fullTime(departureTime)}</Text>
        </View>
        <View className="items-center px-2">
          <Text className="text-zinc-600 text-[10px]">{duration} min</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            {transitLegs.map((leg, i) => (
              <ModeBadge key={i} mode={leg.mode} size="sm" />
            ))}
          </View>
        </View>
        <View className="items-end">
          <Text className="text-zinc-500 text-[10px] uppercase font-semibold">Arrive</Text>
          <Text className="text-[#30D158] text-sm font-bold">{fullTime(arrivalTime)}</Text>
        </View>
      </View>

      <View className="flex-row min-h-[40px] mb-1">
        <View className="items-center mr-3 w-3">
          <View className="w-3 h-3 rounded-full bg-brand-primary" />
          <View className="w-0.5 flex-1 bg-zinc-600 mt-1 rounded-full min-h-[12px]" />
        </View>
        <View className="flex-1 flex-row pb-2">
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">{origin}</Text>
            <Text className="text-zinc-500 text-xs mt-0.5">Start · {fullTime(legs[0].departure)}</Text>
          </View>
          <Text className="text-zinc-500 text-sm">{shortTime(legs[0].departure)}</Text>
        </View>
      </View>

      {legs.map((leg, index) => {
        const prev = legs[index - 1];
        const wait =
          prev && leg.mode !== "walk"
            ? waitMinutesBetween(prev, leg)
            : 0;
        const alightPlatform =
          prev?.destinationPlatform && prev.destinationPlatform !== "—"
            ? formatPlatform(prev.destinationPlatform, prev.mode)
            : null;
        const boardPlatform =
          leg.platform && leg.platform !== "—" ? formatPlatform(leg.platform, leg.mode) : null;

        const isLastTransit =
          leg.mode !== "walk" &&
          !legs.slice(index + 1).some((l) => l.mode !== "walk");

        return (
          <View key={`leg-${index}`}>
            {wait >= 2 ? <WaitRow minutes={wait} /> : null}
            {wait >= 2 && leg.mode !== "walk" ? (
              <TransferInfoRow
                station={leg.originName || prev?.destinationName}
                alightPlatform={alightPlatform}
                boardPlatform={boardPlatform}
              />
            ) : null}
            {leg.mode === "walk" ? (
              <WalkRow leg={leg} />
            ) : (
              <TransitLegBlock
                leg={leg}
                isLast={isLastTransit}
                destinationName={destinationName}
              />
            )}
          </View>
        );
      })}

      <View className="flex-row min-h-[40px] mt-1">
        <View className="items-center mr-3 w-3">
          <View className="w-3 h-3 rounded-full bg-brand-secondary" />
        </View>
        <View className="flex-1 flex-row">
          <View className="flex-1">
            <Text className="text-white font-bold text-sm">{destination}</Text>
            <Text className="text-[#30D158] text-xs mt-0.5 font-medium">
              Arrive {fullTime(arrivalTime)} · {duration} min total
            </Text>
          </View>
          <Text className="text-zinc-500 text-sm">{shortTime(arrivalTime)}</Text>
        </View>
      </View>
    </View>
  );
}
