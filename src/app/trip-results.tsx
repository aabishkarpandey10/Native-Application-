import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, SectionList, View, type SectionList as SectionListType } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpDown, Clock, Locate, Settings } from "lucide-react-native";
import { BackButton, Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { TripDetailSheet } from "../components/tripview/TripDetailSheet";
import { TripResultRow } from "../components/tripview/TripResultRow";
import type { JourneyRoute } from "../constants/sampleData";
import { FeatureGate } from "../components/FeatureGate";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useColors } from "../hooks/useColors";
import { useAppConfig } from "../hooks/useAppConfig";
import { useTripPlan } from "../hooks/useTripPlan";
import { useStore } from "../store/store";
import { tripViaLabel, tripsToDisplay, preferLiveTrips } from "../utils/displayAdapters";
import {
  formatRouteCodes,
  normalizeTripMode,
  resolveTripDisplayMode,
  tripAccentColor,
} from "../utils/tripDisplay";
import { buildTripScheduleSections, shortStationName } from "../utils/tripViewFormat";
import { HAIRLINE, MIN_TOUCH, SPACING, safeBottomInset } from "../constants/design";
import { getTripFooterClearance } from "../constants/layout";
import { formatSydneyTime } from "../utils/tfnswTime";
import { resolveStationByName } from "../utils/resolveStation";

export default function TripResultsScreen() {
  const { tripPlanner } = useAppFeatures();
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
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<JourneyRoute | null>(null);
  const origin = swapped ? toName : fromName;
  const dest = swapped ? fromName : toName;

  const { data: appConfig } = useAppConfig();
  const stationIds = useMemo(
    () => ({
      originId: swapped ? toId : fromId,
      destinationId: swapped ? fromId : toId,
    }),
    [swapped, fromId, toId]
  );

  /** Fast upcoming trips — shown within ~2s while full-day loads in background. */
  const fastPlan = useTripPlan(origin, dest, undefined, {
    ...stationIds,
    fullDay: false,
    includePast: false,
  });
  const fullPlan = useTripPlan(origin, dest, undefined, {
    ...stationIds,
    fullDay: true,
    includePast: true,
    enabled: !upcomingOnly,
  });

  const isBusTrip =
    planMode === "bus" || fromId.endsWith("_B") || toId.endsWith("_B");

  const data = useMemo(() => {
    const raw = upcomingOnly
      ? fastPlan.data
      : fullPlan.data?.length
        ? fullPlan.data
        : fastPlan.data;
    return preferLiveTrips(raw);
  }, [upcomingOnly, fastPlan.data, fullPlan.data]);

  const usingFullDay = !upcomingOnly && Boolean(fullPlan.data?.length) && data === fullPlan.data;
  const isLoading = !data?.length && fastPlan.isLoading;
  const isFetching = upcomingOnly ? fastPlan.isFetching : fullPlan.isFetching;
  const isError =
    upcomingOnly
      ? fastPlan.isError
      : fullPlan.isError && !fastPlan.data?.length && !fullPlan.data?.length;
  const dataUpdatedAt = usingFullDay ? fullPlan.dataUpdatedAt : fastPlan.dataUpdatedAt;
  const loadingFullDay =
    !upcomingOnly && Boolean(fastPlan.data?.length) && fullPlan.isFetching && !fullPlan.data?.length;

  const refetchFresh = useCallback(async () => {
    const freshFast = await fastPlan.refetchFresh();
    if (upcomingOnly) return freshFast;
    const freshFull = await fullPlan.refetchFresh();
    return freshFull ?? freshFast;
  }, [fastPlan, fullPlan, upcomingOnly]);

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

  const schedule = useMemo(
    () =>
      buildTripScheduleSections(routes, {
        includePast: !upcomingOnly,
      }),
    [routes, upcomingOnly]
  );
  const { sections: tripSections, anchor, pastShown, upcomingCount } = schedule;

  const listRef = useRef<SectionListType<JourneyRoute>>(null);
  const didAnchorScroll = useRef(false);

  useEffect(() => {
    didAnchorScroll.current = false;
  }, [origin, dest, upcomingOnly, routes.length]);

  useEffect(() => {
    if (didAnchorScroll.current || upcomingOnly || tripSections.length === 0) return;
    const upSection = tripSections.find((s) => s.title === "Up next");
    if (!upSection?.data.length) return;

    const timer = setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex: anchor.sectionIndex,
        itemIndex: anchor.itemIndex,
        animated: false,
        viewPosition: 0,
      });
      didAnchorScroll.current = true;
    }, 50);
    return () => clearTimeout(timer);
  }, [tripSections, anchor, upcomingOnly]);
  const updatedLabel = dataUpdatedAt
    ? hasLiveTrips
      ? `Live trip times updated at ${formatSydneyTime(new Date(dataUpdatedAt), {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })}`
      : `Updated ${formatSydneyTime(new Date(dataUpdatedAt), {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}`
    : "";

  const footerClearance = getTripFooterClearance(insets.bottom);

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
    <FeatureGate enabled={tripPlanner} title="Trip planner unavailable" message="Trip planning is turned off in admin settings.">
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        left={<BackButton onPress={goBack} />}
        center={
          <Pressable
            onPress={() => setSwapped((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel="Swap origin and destination"
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, maxWidth: "100%" }}
          >
            <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
              {shortStationName(origin)}
            </Txt>
            <ArrowUpDown size={18} color={c.textSecondary} strokeWidth={2} />
            <Txt size={16} weight="600" color={c.text} numberOfLines={1}>
              {shortStationName(dest)}
            </Txt>
          </Pressable>
        }
        right={
          <Pressable
            onPress={() => void refetchFresh()}
            accessibilityRole="button"
            accessibilityLabel="Refresh trips"
            style={{
              width: MIN_TOUCH - 4,
              height: MIN_TOUCH - 4,
              borderRadius: (MIN_TOUCH - 4) / 2,
              backgroundColor: c.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Locate size={20} color={c.text} strokeWidth={2} />
          </Pressable>
        }
      />

      {isLoading && routes.length === 0 ? (
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
              ? "Check that the backend is running and timetables are imported."
              : "Try different station names or run npm run sync:all-timetables."}
          </Txt>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ marginHorizontal: SPACING.screen, marginTop: 10, marginBottom: 6, gap: 8 }}>
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
                {upcomingOnly
                  ? `${upcomingCount} upcoming trip${upcomingCount !== 1 ? "s" : ""} · tap for stops and changes`
                  : `${upcomingCount} upcoming until end of service${pastShown > 0 ? ` · scroll up for last ${pastShown} earlier trip${pastShown !== 1 ? "s" : ""}` : ""}`}
              </Txt>
            </View>
            <Pressable
              onPress={() => setUpcomingOnly((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={upcomingOnly ? "Show full day timetable" : "Show upcoming trips only"}
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
                {upcomingOnly ? "Show full day timetable" : "Upcoming trips only"}
              </Txt>
            </Pressable>
            {loadingFullDay ? (
              <Txt size={13} color={c.textSecondary} style={{ textAlign: "center" }}>
                Loading rest of today…
              </Txt>
            ) : isFetching && !upcomingOnly ? (
              <Txt size={13} color={c.textSecondary} style={{ textAlign: "center" }}>
                Refreshing live trips…
              </Txt>
            ) : null}
          </View>
          <SectionList
          ref={listRef}
          style={{ flex: 1 }}
          sections={tripSections}
          keyExtractor={(r) => r.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                paddingHorizontal: SPACING.screen,
                paddingTop: section.title === "Earlier today" ? 10 : 14,
                paddingBottom: 8,
                backgroundColor: c.bg,
              }}
            >
              <Txt size={14} weight="700" color={c.text}>
                {section.title}
              </Txt>
              <Txt size={12} color={c.textSecondary}>
                {section.title === "Earlier today"
                  ? `Last ${section.data.length} departed · scroll up · grey`
                  : `${section.data.length} trip${section.data.length !== 1 ? "s" : ""} · scroll down for later`}
              </Txt>
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.title === "Earlier today" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginHorizontal: SPACING.screen,
                  marginTop: 4,
                  marginBottom: 12,
                  gap: 10,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: c.separator }} />
                <Txt size={12} weight="600" color={c.textSecondary}>
                  Now
                </Txt>
                <View style={{ flex: 1, height: 1, backgroundColor: c.separator }} />
              </View>
            ) : null
          }
          renderItem={({ item: r }) => {
            const displayMode = resolveTripDisplayMode(r, planMode, fromId, toId);
            const accent = tripAccentColor(r.chips, displayMode);
            const routeCode = formatRouteCodes(r.chips);
            const isBusTrip = displayMode === "bus" || planMode === "bus";
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
                viaLabel={r.itinerary ? tripViaLabel(r.itinerary) : undefined}
                platformLabel={isBusTrip ? "Stand" : "Plat"}
                onPress={() => setSelectedTrip(r)}
              />
            );
          }}
          ListFooterComponent={<View style={{ height: footerClearance }} />}
        />
        </View>
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
          paddingBottom: safeBottomInset(insets.bottom),
          paddingTop: 10,
          paddingHorizontal: SPACING.screen,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: c.barBg,
          borderTopWidth: HAIRLINE,
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
    </FeatureGate>
  );
}
