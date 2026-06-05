import { useMemo } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDown, X } from "lucide-react-native";
import { Txt } from "../design";
import { MIN_TOUCH } from "../../constants/design";
import type { JourneyRoute } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import {
  formatRouteCodes,
  legAccentColor,
  legModeLabel,
  transferWaitMinutes,
  tripAccentColor,
} from "../../utils/tripDisplay";
import { trainOnlyTripSummary } from "../../utils/tripLegs";
import { formatTripClock } from "../../utils/tfnswTime";
import { shortStationName } from "../../utils/tripViewFormat";
import { buildLegTimetable } from "../../utils/legStopTimes";

function shortStop(name: string): string {
  return name
    .replace(/\s+Station$/i, "")
    .replace(/\s+Light Rail(?:\s+stop)?$/i, "")
    .replace(/,\s*Sydney$/i, "")
    .trim();
}

function formatPlatform(platform?: string, mode?: string): string | null {
  const p = String(platform || "").trim();
  if (!p || p === "—" || p === "-") return null;
  if (mode === "light_rail" || mode === "lightrail") return null;
  if (/platform|wharf|stand/i.test(p)) return p;
  if (mode === "ferry") return `Wharf ${p}`;
  return `Platform ${p}`;
}

function TransferDivider({
  waitMin,
  changeAt,
  alightPlatform,
  boardPlatform,
  nextRoute,
  accentColor,
}: {
  waitMin: number;
  changeAt?: string;
  alightPlatform?: string | null;
  boardPlatform?: string | null;
  nextRoute: string;
  accentColor: string;
}) {
  const c = useColors();
  const transferBits = [
    changeAt ? `at ${shortStop(changeAt)}` : null,
    alightPlatform ? `alight ${alightPlatform}` : null,
    boardPlatform ? `board ${boardPlatform}` : null,
  ].filter(Boolean);
  return (
    <View
      style={{
        marginVertical: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: c.muted,
        borderWidth: 1,
        borderColor: c.separator,
        alignItems: "center",
      }}
    >
      <ArrowDown size={18} color={accentColor} strokeWidth={2.2} />
      <Txt size={11} weight="700" color={c.textSecondary} style={{ marginTop: 6, letterSpacing: 0.6 }}>
        CHANGE
      </Txt>
      <Txt size={14} weight="600" color={c.text} style={{ marginTop: 4, textAlign: "center" }}>
        {waitMin > 0 ? `Wait ${waitMin} min` : "Transfer"}
        {nextRoute ? ` · board ${nextRoute}` : ""}
      </Txt>
      {transferBits.length > 0 ? (
        <Txt size={12} color={c.textSecondary} style={{ marginTop: 4, textAlign: "center" }}>
          {transferBits.join(" · ")}
        </Txt>
      ) : null}
    </View>
  );
}

export function TripDetailSheet({
  trip,
  originName,
  destName,
  tripMode,
  showWalkLegs = false,
  visible,
  onClose,
}: {
  trip: JourneyRoute | null;
  originName: string;
  destName: string;
  tripMode?: string;
  showWalkLegs?: boolean;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  const { legs, durationMin, transfers, departLabel, arriveLabel, accentColor } = useMemo(() => {
    if (!trip?.itinerary?.legs?.length) {
      return {
        legs: [],
        durationMin: trip?.durationMin ?? 0,
        transfers: "Direct",
        departLabel: trip?.depart ?? "",
        arriveLabel: trip?.arrive ?? "",
        accentColor: tripAccentColor(trip?.chips ?? [], tripMode),
      };
    }
    const summary = trainOnlyTripSummary(trip.itinerary.legs, { includeWalk: showWalkLegs });
    const changes =
      summary.transfers === 0
        ? "Direct"
        : `${summary.transfers} change${summary.transfers > 1 ? "s" : ""}`;
    return {
      legs: summary.legs,
      durationMin: summary.durationMin || trip.durationMin,
      transfers: changes,
      departLabel: summary.departure ? formatTripClock(summary.departure) : trip.depart,
      arriveLabel: summary.arrival ? formatTripClock(summary.arrival) : trip.arrive,
      accentColor: tripAccentColor(trip.chips, tripMode),
    };
  }, [trip, tripMode, showWalkLegs]);

  if (!trip) return null;

  const routeSummary = formatRouteCodes(trip.chips);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View
        style={{
          maxHeight: "78%",
          backgroundColor: c.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 10,
            borderBottomWidth: 0.5,
            borderBottomColor: c.separator,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt size={17} weight="700" color={c.text}>
              {shortStationName(originName)} → {shortStationName(destName)}
            </Txt>
            <Txt size={13} color={c.textSecondary} style={{ marginTop: 4 }}>
              {departLabel} – {arriveLabel} · {durationMin} min · {transfers}
            </Txt>
            {routeSummary !== "—" ? (
              <Txt size={13} weight="600" color={accentColor} style={{ marginTop: 4 }}>
                {routeSummary}
              </Txt>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" }}
          >
            <X size={22} color={c.text} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {legs.length === 0 ? (
            <Txt size={14} color={c.textSecondary}>
              No transit segment available for this trip.
            </Txt>
          ) : (
            legs.map((leg, legIdx) => {
              const timeline = buildLegTimetable(leg);
              const hasTimedStops = timeline.length >= 2;
              const stops = hasTimedStops
                ? timeline.map((row) => row.name)
                : leg.stops?.length
                  ? leg.stops
                  : [leg.originName, leg.destinationName].filter(Boolean);
              const isWalk = leg.mode === "walk";
              const legColor = isWalk ? c.textSecondary : legAccentColor(leg);
              const route = leg.routeNumber || leg.mode.toUpperCase();
              const prevLeg = legIdx > 0 ? legs[legIdx - 1] : null;

              return (
                <View key={`leg-${legIdx}`}>
                  {prevLeg && !isWalk && prevLeg.mode !== "walk" ? (
                    <TransferDivider
                      waitMin={transferWaitMinutes(prevLeg, leg)}
                      changeAt={leg.originName || prevLeg.destinationName}
                      alightPlatform={formatPlatform(prevLeg.destinationPlatform, prevLeg.mode)}
                      boardPlatform={formatPlatform(leg.platform, leg.mode)}
                      nextRoute={route}
                      accentColor={legColor}
                    />
                  ) : null}
                  <View style={{ marginBottom: legIdx === legs.length - 1 ? 0 : 4 }}>
                    <Txt size={13} weight="600" color={legColor} style={{ marginBottom: 8 }}>
                      {isWalk
                        ? `Walk · ${leg.duration} min`
                        : `${legModeLabel(leg.mode, route)} · ${leg.duration} min`}
                      {!isWalk && formatPlatform(leg.platform, leg.mode)
                        ? ` · ${formatPlatform(leg.platform, leg.mode)}`
                        : ""}
                    </Txt>
                    <Txt size={12} color={c.textSecondary} style={{ marginBottom: 8 }}>
                      {formatTripClock(leg.departure)} – {formatTripClock(leg.arrival)}
                    </Txt>
                    {stops.map((stop, i) => (
                      <View
                        key={`${legIdx}-${i}-${stop}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 8,
                          borderLeftWidth: 2,
                          borderLeftColor: legColor,
                          paddingLeft: 12,
                          marginLeft: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor:
                              i === 0 || i === stops.length - 1 ? legColor : c.separator,
                            marginRight: 10,
                          }}
                        />
                        <Txt
                          size={15}
                          weight={i === 0 || i === stops.length - 1 ? "600" : "400"}
                          color={c.text}
                          style={{ flex: 1 }}
                        >
                          {shortStop(String(stop))}
                        </Txt>
                        {hasTimedStops && timeline[i] ? (
                          <Txt size={12} color={c.textSecondary}>
                            {formatTripClock(timeline[i].time)}
                          </Txt>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
