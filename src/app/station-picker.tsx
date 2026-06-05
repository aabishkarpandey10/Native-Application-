import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  Pressable,
  SectionList,
  TextInput,
  View,
  type SectionListRenderItem,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cell, GroupedList, SectionHeader, Txt } from "../components/design";
import { MIN_TOUCH, SPACING, titleWeight } from "../constants/design";
import type { Station } from "../constants/stations";
import { useBusStationSearch, useStations } from "../hooks/useStations";
import { useColors } from "../hooks/useColors";
import { useStore } from "../store/store";
import { buildStationSections } from "../utils/stationSections";
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
    if (station.id.includes("KINGSFORD") || station.id.includes("UNSWANZAC") || station.id.includes("ESMARKS") || station.id.includes("KENSINGTON")) {
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

type PickerListSection = {
  title: string;
  data: [Station[]];
};

function StationRows({
  stations,
  mode,
  onSelect,
}: {
  stations: Station[];
  mode: string;
  onSelect: (s: Station) => void;
}) {
  const c = useColors();
  return (
    <GroupedList inset={SPACING.screen}>
      {stations.map((station) => {
        const badge = lineLabel(station, mode);
        return (
          <Cell
            key={station.id}
            onPress={() => onSelect(station)}
            accessibilityLabel={shortStationName(station.name)}
          >
            <View style={{ flex: 1 }}>
              <Txt size={17} color={c.text}>
                {shortStationName(station.name)}
              </Txt>
              {badge ? (
                <Txt size={13} color={c.textSecondary} style={{ marginTop: 2 }}>
                  {badge}
                </Txt>
              ) : null}
            </View>
          </Cell>
        );
      })}
    </GroupedList>
  );
}

export default function StationPickerScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const userLocation = useStore((s) => s.userLocation);
  const params = useLocalSearchParams<{
    role?: string;
    mode?: string;
    flow?: string;
    fromId?: string;
    fromName?: string;
  }>();

  const role = params.role === "to" ? "to" : "from";
  const mode = String(params.mode ?? "train");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [showAll, setShowAll] = useState(mode !== "bus");

  const title = role === "from" ? "From station" : "To station";
  const isBus = mode === "bus";
  const { data: coreStations = [], isLoading: coreLoading } = useStations(mode);
  const searchTrim = search.trim();
  const deferredSearch = useDeferredValue(searchTrim);
  const busQuery = useBusStationSearch(deferredSearch, {
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    enabled: isBus,
  });
  const busStations = busQuery.data ?? [];
  const isLoading = isBus ? busQuery.isLoading : coreLoading;

  const sections = useMemo(() => {
    if (isBus) {
      const q = searchTrim.toLowerCase();
      if (q.length >= 2) {
        return busStations.length
          ? [{ title: "Results", data: busStations }]
          : [];
      }
      if (sort === "distance" && userLocation) {
        return busStations.length
          ? [{ title: "Nearby bus stops", data: busStations }]
          : [];
      }
      return busStations.length
        ? [{ title: "Popular", data: busStations }]
        : [];
    }

    const filter = modeFilter(mode);
    let stations = coreStations.filter(filter);
    const q = searchTrim.toLowerCase();
    if (q) {
      stations = stations.filter((s) => s.name.toLowerCase().includes(q));
      return buildStationSections(stations);
    }

    if (sort === "distance" && userLocation) {
      stations = [...stations].sort((a, b) => {
        const da =
          (a.lat - userLocation.lat) ** 2 + (a.lon - userLocation.lng) ** 2;
        const db =
          (b.lat - userLocation.lat) ** 2 + (b.lon - userLocation.lng) ** 2;
        return da - db;
      });
      return [{ title: "Nearby", data: stations }];
    }

    const popularIds = new Set(popularIdsForMode(mode));
    const popular = popularIds.size
      ? stations.filter((s) => popularIds.has(s.id))
      : [];
    const rest = stations.filter((s) => !popularIds.has(s.id));
    const letterSections = buildStationSections(rest);
    if (!showAll && popular.length > 0) {
      return [{ title: "Popular", data: popular }];
    }
    if (popular.length > 0) {
      return [{ title: "Popular", data: popular }, ...letterSections];
    }
    return letterSections;
  }, [mode, isBus, deferredSearch, searchTrim, sort, userLocation, coreStations, busStations, showAll]);

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

  const listSections = useMemo<PickerListSection[]>(
    () =>
      sections
        .filter((section) => section.data.length > 0)
        .map((section) => ({ title: section.title, data: [section.data] })),
    [sections]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: PickerListSection }) => <SectionHeader title={section.title} />,
    []
  );

  const renderItem: SectionListRenderItem<Station[], PickerListSection> = useCallback(
    ({ item: stations }) => (
      <View style={{ marginBottom: 12 }}>
        <StationRows stations={stations} mode={mode} onSelect={onSelect} />
      </View>
    ),
    [mode, onSelect]
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 8,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 0.5,
          borderBottomColor: c.separator,
          backgroundColor: c.card,
        }}
      >
        <Pressable
          onPress={goBack}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={26} color={c.text} strokeWidth={2.2} />
        </Pressable>
        <Txt size={17} weight={titleWeight()} color={c.text} style={{ flex: 1, textAlign: "center" }}>
          {title}
        </Txt>
        <View style={{ width: 44 }} />
      </View>

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
            borderRadius: 10,
            paddingHorizontal: 14,
            minHeight: MIN_TOUCH,
            fontSize: 16,
            color: c.text,
            borderWidth: 0.5,
            borderColor: c.separator,
          }}
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {(
            [
              ["distance", "Nearby"],
              ["name", "A–Z"],
            ] as const
          ).map(([key, label]) => {
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

      <SectionList
        style={{ flex: 1 }}
        sections={listSections}
        keyExtractor={(stations, index) =>
          `section-block-${index}-${stations[0]?.id ?? "empty"}`
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={9}
        removeClippedSubviews
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24,
          flexGrow: listSections.length === 0 ? 1 : undefined,
        }}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: "center" }}>
            <Txt size={15} color={c.textSecondary}>
              {isBus && searchTrim.length < 2
                ? "Search for a bus stop above."
                : "No stations match your search."}
            </Txt>
          </View>
        }
        ListFooterComponent={
          canShowAll && !showAll ? (
            <Pressable
              onPress={() => setShowAll(true)}
              style={{
                marginHorizontal: SPACING.screen,
                marginTop: 4,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: c.card,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: c.separator,
              }}
            >
              <Txt size={16} weight="600" color={c.primary}>
                {mode === "bus" ? "Show all bus stops (A–Z)" : "Show all stations (A–Z)"}
              </Txt>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
