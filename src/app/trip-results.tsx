import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpDown, ChevronLeft, Clock, Locate, Settings } from "lucide-react-native";
import { Txt } from "../components/design";
import { TripDetailSheet } from "../components/tripview/TripDetailSheet";
import { TripResultRow } from "../components/tripview/TripResultRow";
import type { JourneyRoute } from "../constants/sampleData";
import { useColors } from "../hooks/useColors";
import { useAppConfig } from "../hooks/useAppConfig";
import { useTripPlan } from "../hooks/useTripPlan";
import { useStore } from "../store/store";
import { tripsToDisplay } from "../utils/displayAdapters";
import {
  formatRouteCodes,
  normalizeTripMode,
  resolveTripDisplayMode,
  tripAccentColor,
} from "../utils/tripDisplay";
import { shortStationName } from "../utils/tripViewFormat";
import { formatSydneyTime } from "../utils/tfnswTime";
import { resolveStationByName } from "../utils/resolveStation";

export default function TripResultsScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const addSavedTrip = useStore((s) => s.addSavedTrip);
  const removeSavedTrip = useStore((s) => s.removeSavedTrip);
  const savedTrips = useStore((s) => s.savedTrips);
  const params = useLocalSearchParams<{
    fromId?: string;
    fromName?: string;
    toId?: string;
    toName?: string;
    mode?: string;
  }>();

  const fromName = String(params.fromName ?? "");
  const toName = String(params.toName ?? "");
  const fromId = String(params.fromId ?? "");
  const toId = String(params.toId ?? "");
  const planMode = String(params.mode ?? "");

  const [swapped, setSwapped] = useState(false);
  const [showEarlierTrips, setShowEarlierTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<JourneyRoute | null>(null);
  const origin = swapped ? toName : fromName;
  const dest = swapped ? fromName : toName;

  const { data: appConfig } = useAppConfig();
  const tripPlanOptions = useMemo(
    () => ({
      originId: swapped ? toId : fromId,
      destinationId: swapped ? fromId : toId,
      includePast: showEarlierTrips,
    }),
    [swapped, fromId, toId, showEarlierTrips]
  );
  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useTripPlan(
    origin,
    dest,
    undefined,
    tripPlanOptions
  );

  const routes = useMemo(() => {
    if (!data?.length) return [];
    let list = tripsToDisplay(data, { showWalkLegs: appConfig?.showWalkLegsInTrips });
    if (planMode === "bus" || fromId.endsWith("_B") || toId.endsWith("_B")) {
      const withBus = list.filter((r) =>
        r.chips.some((c) => c.mode === "bus")
      );
      if (withBus.length > 0) list = withBus;
    }
    return list;
  }, [data, appConfig?.showWalkLegsInTrips, planMode, fromId, toId]);

  const hasLiveTrips = routes.some((r) => r.isLive);
  const pastCount = routes.filter((r) => r.isPast).length;
  const loadingEarlier = showEarlierTrips && isFetching && pastCount === 0;
  const updatedLabel = dataUpdatedAt
    ? hasLiveTrips
      ? `Live trip times updated at ${formatSydneyTime(new Date(dataUpdatedAt), {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}`
      : `Timetable times · refreshed ${formatSydneyTime(new Date(dataUpdatedAt), {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}`
    : "";

  const savedTrip = useMemo(() => {
    const orig = resolveStationByName(origin) ?? { id: fromId, name: origin };
    const dst = resolveStationByName(dest) ?? { id: toId, name: dest };
    return savedTrips.find((t) => t.origin_id === orig.id && t.destination_id === dst.id) ?? null;
  }, [savedTrips, origin, dest, fromId, toId]);

  const onSave = () => {
    const orig = resolveStationByName(origin) ?? { id: fromId, name: origin };
    const dst = resolveStationByName(dest) ?? { id: toId, name: dest };
    if (savedTrip) {
      removeSavedTrip(savedTrip.id);
      Alert.alert("Trip removed", "Removed from your Trips tab.");
      return;
    }
    const active = routes.find((r) => !r.isPast) ?? routes[0];
    const displayMode = active
      ? resolveTripDisplayMode(active, planMode, fromId, toId)
      : normalizeTripMode(planMode);
    const firstChip = active?.chips[0];
    addSavedTrip({
      id: `trip_${orig.id}_${dst.id}_${Date.now()}`,
      origin_id: orig.id,
      origin_name: orig.name,
      destination_id: dst.id,
      destination_name: dst.name,
      transit_mode:
        displayMode === "light_rail"
          ? "light_rail"
          : displayMode === "metro" ||
              displayMode === "bus" ||
              displayMode === "ferry"
            ? displayMode
            : "train",
      route_number: firstChip?.route ?? (displayMode === "light_rail" ? "L2" : "T1"),
    });
    Alert.alert("Trip saved", "Added to your Trips tab.");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 12,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: c.separator,
        }}
      >
        <Pressable
          onPress={goBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>

        <Pressable
          onPress={() => setSwapped((s) => !s)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
            {shortStationName(origin)}
          </Txt>
          <ArrowUpDown size={18} color={c.textSecondary} strokeWidth={2} />
          <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
            {shortStationName(dest)}
          </Txt>
        </Pressable>

        <Pressable
          onPress={() => void refetch()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Locate size={20} color={c.text} strokeWidth={2} />
        </Pressable>
      </View>

      {isLoading && !showEarlierTrips && routes.length === 0 ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <Txt size={15} color={c.textSecondary}>
            Finding trips…
          </Txt>
        </View>
      ) : routes.length === 0 ? (
        <View style={{ padding: 32, alignItems: "center" }}>
          <Txt size={16} weight="600" color={c.text}>
            No trips found
          </Txt>
          <Txt size={14} color={c.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
            {isError
              ? "Check that the backend is running."
              : "Try different station names."}
          </Txt>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={
            <View style={{ marginHorizontal: 12, marginTop: 10, marginBottom: 6, gap: 8 }}>
              <View
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.separator,
                  backgroundColor: c.card,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Txt size={12} color={c.textSecondary}>
                  {showEarlierTrips && pastCount > 0
                    ? `${pastCount} earlier trip${pastCount !== 1 ? "s" : ""} today in grey · tap for stops and changes.`
                    : showEarlierTrips && loadingEarlier
                      ? "Loading earlier trips from today's timetable…"
                      : routes.some((r) => r.isPast)
                        ? "Earlier trips today are shown in grey. Tap a trip for full stops and changes."
                        : "Tap a trip to see stops, times, and any changes."}
                </Txt>
              </View>
              {!showEarlierTrips ? (
                <Pressable
                  onPress={() => setShowEarlierTrips(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Show earlier trips today"
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: c.primary,
                    backgroundColor: pressed ? c.separator : c.card,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                  })}
                >
                  <Clock size={18} color={c.primary} strokeWidth={2} />
                  <Txt size={15} weight="600" color={c.primary}>
                    Show earlier trips today
                  </Txt>
                </Pressable>
              ) : loadingEarlier ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 10,
                  }}
                >
                  <Txt size={14} color={c.textSecondary}>
                    Loading earlier trips…
                  </Txt>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item: r }) => {
            const displayMode = resolveTripDisplayMode(r, planMode, fromId, toId);
            const accent = tripAccentColor(r.chips, displayMode);
            const routeCode = formatRouteCodes(r.chips);
            return (
              <TripResultRow
                leaveInMinutes={r.leaveInMinutes ?? 0}
                originName={origin}
                destName={dest}
                departClock={r.depart}
                arriveClock={r.arrive}
                routeCode={routeCode}
                accentColor={accent}
                isPast={r.isPast}
                onTime={!r.isPast}
                realtime={!isError && !r.isPast && r.isLive === true}
                onPress={() => setSelectedTrip(r)}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
      )}

      <TripDetailSheet
        trip={selectedTrip}
        originName={origin}
        destName={dest}
        tripMode={planMode}
        showWalkLegs={appConfig?.showWalkLegsInTrips}
        visible={!!selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 10,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.92)",
          borderTopWidth: 0.5,
          borderTopColor: c.separator,
        }}
      >
        <Pressable onPress={() => router.push("/settings" as never)} style={{ padding: 8 }}>
          <Settings size={22} color={c.text} strokeWidth={2} />
        </Pressable>
        <Txt size={11} color={c.textSecondary} style={{ flex: 1, textAlign: "center" }} numberOfLines={2}>
          {updatedLabel || "Times shown with am/pm · pull refresh for latest"}
        </Txt>
        <Pressable
          onPress={onSave}
          accessibilityLabel={savedTrip ? "Remove saved trip" : "Save trip"}
          style={{
            paddingHorizontal: 10,
            minHeight: 34,
            borderRadius: 8,
            backgroundColor: c.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt size={14} weight="600" color={c.primary}>
            {savedTrip ? "Remove" : "Save"}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
