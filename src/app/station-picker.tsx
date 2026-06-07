import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GroupedList, ListRow, SectionHeader, StackHeader, Txt } from "../components/design";
import { MIN_TOUCH, RADIUS, SPACING, resolveTextStyle } from "../constants/design";
import { getStackContentClearance } from "../constants/layout";
import type { Station } from "../constants/stations";
import { useBusStationSearch, useStations, useStationsSearch } from "../hooks/useStations";
import { getStationsSync } from "../services/stationsService";
import { getBusStopsForRoute } from "../constants/busNetworks";
import { FeatureGate } from "../components/FeatureGate";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useColors } from "../hooks/useColors";
import { useStore } from "../store/store";
import { buildStationSections, type StationSection } from "../utils/stationSections";
import { shortStationName } from "../utils/tripViewFormat";

type SortMode = "name" | "distance";

const POPULAR_TRAIN_IDS = [
  "CENTRAL_T",
  "TOWNHALL_T",
  "CIRCULARQUAY_T",
  "PARRAMATTA_T",
  "CHATSWOOD_T",
  "BONDIJUNCTION_T",
];

const POPULAR_LIGHT_RAIL_IDS = [
  "CENTRAL_LR",
  "CIRCULARQUAY_LR",
  "TOWNHALL_LR",
  "HAYMARKET_LR",
  "RANDWICK_LR",
  "KINGSFORD_LR",
];

const POPULAR_FERRY_IDS = [
  "CIRCULARQUAY_F",
  "MANLY_F",
  "BARANGAROO_F",
  "DARLINGHARBOURKINGSTREET_F",
  "WATSONSBAY_F",
  "COCKATOOISLAND_F",
];

const POPULAR_BUS_IDS = [
  "CIRCULARQUAY_B",
  "CENTRALSTATION_B",
  "BONDIJUNCTIONSTATION_B",
  "BONDIBEACH_B",
  "PARRAMATTASTATION_B",
  "CHATSWOODSTATION_B",
];

const POPULAR_METRO_IDS = [
  "TALLAWONG_M",
  "CHATSWOOD_M",
  "BARANGAROO_M",
  "GADIGAL_M",
  "CENTRAL_M",
  "SYDENHAM_M",
  "BANKSTOWN_M",
  "CAMPSIE_M",
];

function modeFilter(mode: string): (s: Station) => boolean {
  if (mode === "train") return (s) => s.mode === "train";
  if (mode === "metro") return (s) => s.mode === "metro";
  if (mode === "bus") return (s) => s.mode === "bus";
  if (mode === "ferry") return (s) => s.mode === "ferry";
  if (mode === "lightrail") return (s) => s.mode === "lightrail";
  return () => true;
}

function popularIdsForMode(mode: string): string[] {
  if (mode === "lightrail") return POPULAR_LIGHT_RAIL_IDS;
  if (mode === "ferry") return POPULAR_FERRY_IDS;
  if (mode === "bus") return POPULAR_BUS_IDS;
  if (mode === "metro") return POPULAR_METRO_IDS;
  if (mode === "train") return POPULAR_TRAIN_IDS;
  return [];
}

function lineLabel(station: Station, mode: string): string | null {
  if (mode === "ferry") {
    if (station.id.includes("CIRCULARQUAY")) return "F1 · F3 · F8";
    return "Ferry";
  }
  if (mode === "bus") return "Bus";
  if (mode !== "lightrail" && mode !== "train" && mode !== "metro") return null;
  if (station.id.endsWith("_LR")) {
    if (
      station.id.includes("KINGSFORD") ||
      station.id.includes("UNSWANZAC") ||
      station.id.includes("ESMARKS") ||
      station.id.includes("KENSINGTON")
    ) {
      return "L3";
    }
    if (
      station.id.includes("RANDWICK") ||
      station.id.includes("MOOREPARK") ||
      station.id.includes("SURRYHILLS") ||
      station.id.includes("WANSEY") ||
      station.id.includes("UNSWHIGH")
    ) {
      return "L2";
    }
    if (
      station.id.includes("DULWICH") ||
      station.id.includes("GLEBE") ||
      station.id.includes("PYRMONT") ||
      station.id.includes("FISHMARKET") ||
      station.id.includes("LILYFIELD")
    ) {
      return "L1";
    }
    if (["CENTRAL_LR", "CIRCULARQUAY_LR", "HAYMARKET_LR", "TOWNHALL_LR"].includes(station.id)) {
      return "L1 · L2 · L3";
    }
    return "Light rail";
  }
  if (station.id.endsWith("_T")) return "Train";
  if (station.id.endsWith("_M")) return "M1";
  return null;
}

function StationSectionBlock({
  section,
  mode,
  onSelect,
}: {
  section: StationSection;
  mode: string;
  onSelect: (s: Station) => void;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <SectionHeader title={section.title} />
      <GroupedList>
        {section.data.map((station) => {
          const badge = lineLabel(station, mode);
          const label = shortStationName(station.name);
          return (
            <ListRow
              key={station.id}
              label={label}
              subtitle={badge ?? undefined}
              onPress={() => onSelect(station)}
              accessibilityLabel={label}
            />
          );
        })}
      </GroupedList>
    </View>
  );
}

export default function StationPickerScreen() {
  const { tripPlanner } = useAppFeatures();
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const userLocation = useStore((s) => s.userLocation);
  const params = useLocalSearchParams<{
    role?: string;
    mode?: string;
    flow?: string;
    route?: string;
    fromId?: string;
    fromName?: string;
  }>();

  const role = params.role === "to" ? "to" : "from";
  const mode = String(params.mode ?? "train");
  const busRoute = String(params.route ?? "").trim();
  const [search, setSearch] = useState("");
  const [routeStopIds, setRouteStopIds] = useState<string[]>([]);

  useEffect(() => {
    if (!busRoute) {
      setRouteStopIds([]);
      return;
    }
    let cancelled = false;
    void getBusStopsForRoute(busRoute).then((ids) => {
      if (!cancelled) setRouteStopIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [busRoute]);

  const [sort, setSort] = useState<SortMode>("name");
  const [showAll, setShowAll] = useState(mode !== "bus");

  const title = role === "from" ? "From station" : "To station";
  const isBus = mode === "bus";
  const { data: coreStations = [], isLoading: coreLoading, isFetching: coreFetching } = useStations(mode);
  const effectiveCoreStations = useMemo(
    () => (coreStations.length > 0 ? coreStations : getStationsSync()),
    [coreStations]
  );
  const searchTrim = search.trim();
  const deferredSearch = useDeferredValue(searchTrim);
  const busQuery = useBusStationSearch(deferredSearch, {
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    enabled: isBus,
  });
  const routeStationsQuery = useStationsSearch({
    mode: "bus",
    ids: routeStopIds.slice(0, 200),
    limit: 200,
    enabled: isBus && busRoute.length > 0 && routeStopIds.length > 0,
  });
  const busStationsRaw = busQuery.data ?? [];
  const busStations = useMemo(() => {
    if (!busRoute) return busStationsRaw;
    const routeList = routeStationsQuery.data ?? [];
    if (routeList.length) return routeList;
    const allowed = new Set(routeStopIds);
    return busStationsRaw.filter((s) => allowed.has(s.id));
  }, [busRoute, busStationsRaw, routeStationsQuery.data, routeStopIds]);
  const isLoading = isBus
    ? busQuery.isLoading || (busRoute ? routeStationsQuery.isLoading : false)
    : coreLoading;

  const sections = useMemo(() => {
    if (isBus) {
      const q = searchTrim.toLowerCase();
      const list = q.length >= 2
        ? busStations.filter((s) => s.name.toLowerCase().includes(q))
        : busStations;
      if (busRoute) {
        return list.length ? [{ title: `Route ${busRoute} stops`, data: list }] : [];
      }
      if (q.length >= 2) {
        return list.length ? [{ title: "Results", data: list }] : [];
      }
      if (sort === "distance" && userLocation) {
        return list.length ? [{ title: "Nearby bus stops", data: list }] : [];
      }
      return list.length ? [{ title: "Popular", data: list }] : [];
    }

    const filter = modeFilter(mode);
    let stations = effectiveCoreStations.filter(filter);
    const q = searchTrim.toLowerCase();
    if (q) {
      stations = stations.filter((s) => s.name.toLowerCase().includes(q));
      return buildStationSections(stations);
    }

    if (sort === "distance" && userLocation) {
      stations = [...stations].sort((a, b) => {
        const da = (a.lat - userLocation.lat) ** 2 + (a.lon - userLocation.lng) ** 2;
        const db = (b.lat - userLocation.lat) ** 2 + (b.lon - userLocation.lng) ** 2;
        return da - db;
      });
      return [{ title: "Nearby", data: stations }];
    }

    const popularIds = new Set(popularIdsForMode(mode));
    const popular = popularIds.size ? stations.filter((s) => popularIds.has(s.id)) : [];
    const rest = stations.filter((s) => !popularIds.has(s.id));
    const letterSections = buildStationSections(rest);
    if (!showAll && popular.length > 0) {
      return [{ title: "Popular", data: popular }];
    }
    if (popular.length > 0) {
      return [{ title: "Popular", data: popular }, ...letterSections];
    }
    return letterSections;
  }, [
    mode,
    isBus,
    busRoute,
    deferredSearch,
    searchTrim,
    sort,
    userLocation,
    effectiveCoreStations,
    busStations,
    showAll,
  ]);

  const flow = String(params.flow ?? "");
  const setAlarmDraft = useStore((s) => s.setAlarmDraft);

  const onSelect = (station: Station) => {
    if (flow === "alarm") {
      if (role === "from") {
        setAlarmDraft({
          origin_id: station.id,
          origin_name: station.name,
          transit_mode:
            station.mode === "lightrail"
              ? "light_rail"
              : (station.mode as "train" | "metro" | "bus" | "ferry"),
        });
        router.push({
          pathname: "/station-picker",
          params: { role: "to", mode, flow: "alarm" },
        } as never);
        return;
      }
      setAlarmDraft({
        destination_id: station.id,
        destination_name: station.name,
      });
      router.back();
      return;
    }

    if (role === "from") {
      router.push({
        pathname: "/station-picker",
        params: {
          role: "to",
          mode,
          fromId: station.id,
          fromName: station.name,
        },
      } as never);
      return;
    }

    const fromId = String(params.fromId ?? "");
    const fromName = String(params.fromName ?? "");
    router.replace({
      pathname: "/trip-results",
      params: {
        fromId,
        fromName,
        toId: station.id,
        toName: station.name,
        mode,
      },
    } as never);
  };

  const canShowAll =
    !isBus && !search.trim() && sort === "name" && popularIdsForMode(mode).length > 0;

  const emptyMessage =
    isLoading || coreFetching
      ? "Loading stations…"
      : isBus && searchTrim.length < 2
        ? "Search for a bus stop above."
        : searchTrim
          ? "No stations match your search."
          : "No stations available for this mode.";

  return (
    <FeatureGate
      enabled={tripPlanner}
      title="Trip planner unavailable"
      message="Trip planning is turned off in admin settings."
    >
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StackHeader title={title} onBack={goBack} />

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: getStackContentClearance(insets.bottom) }}
        >
          <View style={{ paddingHorizontal: SPACING.screen, paddingTop: 12, paddingBottom: 8 }}>
            <TextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                if (text.trim()) setShowAll(true);
              }}
              placeholder="Search stations"
              placeholderTextColor={c.textSecondary}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={{
                backgroundColor: c.card,
                borderRadius: RADIUS.sm,
                paddingHorizontal: 14,
                paddingVertical: 12,
                minHeight: MIN_TOUCH,
                fontSize: 16,
                ...resolveTextStyle("400"),
                color: c.text,
                borderWidth: 0.5,
                borderColor: c.separator,
              }}
            />
            <View style={{ flexDirection: "row", marginTop: 10 }}>
              {(
                [
                  ["distance", "Nearby"],
                  ["name", "A–Z"],
                ] as const
              ).map(([key, label], index) => {
                const active = sort === key;
                const disabled = key === "distance" && !userLocation;
                return (
                  <Pressable
                    key={key}
                    disabled={disabled}
                    onPress={() => {
                      setSort(key);
                      if (key === "distance") setShowAll(true);
                    }}
                    style={{
                      marginLeft: index > 0 ? 8 : 0,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: active ? c.primary : c.muted,
                      opacity: disabled ? 0.45 : 1,
                    }}
                  >
                    <Txt size={14} weight="600" color={active ? "#FFFFFF" : c.text}>
                      {label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
            {isLoading ? (
              <Txt size={13} color={c.textSecondary} style={{ marginTop: 8 }}>
                Loading stations…
              </Txt>
            ) : null}
            {isBus && searchTrim.length < 2 ? (
              <Txt size={13} color={c.textSecondary} style={{ marginTop: 8 }}>
                Type at least 2 characters to search bus stops.
              </Txt>
            ) : null}
          </View>

          {sections.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Txt size={15} color={c.textSecondary} style={{ textAlign: "center", lineHeight: 22 }}>
                {emptyMessage}
              </Txt>
            </View>
          ) : (
            sections.map((section) => (
              <StationSectionBlock
                key={section.title}
                section={section}
                mode={mode}
                onSelect={onSelect}
              />
            ))
          )}

          {canShowAll && !showAll ? (
            <Pressable
              onPress={() => setShowAll(true)}
              style={{
                marginHorizontal: SPACING.screen,
                marginTop: 4,
                marginBottom: 12,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: c.card,
                borderRadius: RADIUS.sm,
                borderWidth: 0.5,
                borderColor: c.separator,
              }}
            >
              <Txt size={16} weight="600" color={c.primary}>
                {mode === "bus" ? "Show all bus stops (A–Z)" : "Show all stations (A–Z)"}
              </Txt>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </FeatureGate>
  );
}
