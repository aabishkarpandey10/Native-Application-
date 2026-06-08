import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Info, RefreshCw } from "lucide-react-native";
import { Chip, DepartureLoadingRows, EmptyState, GroupedList, Cell, IconBtn, Txt } from "../design";
import { ScheduleDepartureCard, ScheduleScreenHeader } from "../schedule";
import { SPACING } from "../../constants/design";
import { getStackContentClearance } from "../../constants/layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SampleDeparture } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { useStationById } from "../../hooks/useStationById";
import { LiveTrackingMap } from "../live/LiveTrackingMap";

interface TimetableViewProps {
  stationName: string;
  stationId?: string;
  routeFilter?: string;
  departures: SampleDeparture[];
  onBack?: () => void;
  loading?: boolean;
  isError?: boolean;
  onRefresh?: () => void;
  live?: boolean;
  scheduleSource?: string | null;
}

function sourceLabel(source: string | null | undefined, isError: boolean): string {
  if (isError) return "Could not load departures — pull to refresh";
  if (source === "timetable-pdf-weekday") {
    return "Weekday PDF timetable · live board preferred on weekends";
  }
  if (source === "tfnsw-live-fullday") {
    return "Full day · live times";
  }
  if (source === "tfnsw-live+timetable-fullday" || source === "tfnsw-live+timetable-pdf-fullday") {
    return "Full day · live times";
  }
  if (source === "tfnsw-live+timetable-gtfs-fullday") {
    return "Full day · live times";
  }
  if (source === "timetable-pdf-fullday") {
    return "Full day timetable · Transport NSW";
  }
  if (source === "timetable-pdf") return "Scheduled weekday times · PDF timetable";
  if (source === "tfnsw-live+timetable-pdf") {
    return "Live departures";
  }
  if (source === "tfnsw-live" || source === "live" || source === "tfnsw") return "Live departures";
  if (source === "cached") return "Cached departures · offline";
  if (source === "mock" || source === "mock-fallback") {
    return "Demo data blocked — configure live API on the server";
  }
  if (source === "unavailable") return "No departures available from Transport NSW";
  return "Upcoming departures";
}

function buildRouteFilters(departures: SampleDeparture[]): string[] {
  const routes = [...new Set(departures.map((d) => d.route).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  if (routes.length <= 1) return [];
  const filters = ["All Routes"];
  for (const r of routes.slice(0, 24)) filters.push(r);
  return filters;
}

function buildPlatformFilters(departures: SampleDeparture[]): string[] {
  const nums = [...new Set(departures.map((d) => parseInt(d.platform, 10)).filter((n) => !Number.isNaN(n)))].sort(
    (a, b) => a - b
  );
  if (nums.length === 0) return ["All Platforms"];
  const filters = ["All Platforms"];
  if (nums.length <= 6) {
    for (const n of nums) filters.push(`Plat ${n}`);
    return filters;
  }
  const min = nums[0];
  const max = nums[nums.length - 1];
  const mid = Math.floor((min + max) / 2);
  filters.push(`Platform ${min}–${mid}`);
  if (mid < max) filters.push(`Platform ${mid + 1}–${max}`);
  return filters;
}

function matchesPlatformFilter(platform: string, filter: string): boolean {
  if (filter === "All Platforms") return true;
  const single = filter.match(/^Plat (\d+)$/);
  if (single) return parseInt(platform, 10) === parseInt(single[1], 10);
  const range = filter.match(/Platform (\d+)–(\d+)/);
  if (range) {
    const p = parseInt(platform, 10);
    return p >= parseInt(range[1], 10) && p <= parseInt(range[2], 10);
  }
  return true;
}

function matchesRouteFilter(route: string, filter: string): boolean {
  if (filter === "All Routes") return true;
  return route.toUpperCase() === filter.toUpperCase();
}

export function TimetableView({
  stationName,
  stationId = "CENTRAL_T",
  routeFilter,
  departures,
  onBack,
  loading,
  isError,
  onRefresh,
  live = true,
  scheduleSource = null,
}: TimetableViewProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: station } = useStationById(stationId);

  const { refreshControl } = useRefreshControl(async () => {
    onRefresh?.();
  });

  const isBus = station?.mode === "bus";
  const routeFilters = useMemo(
    () => (isBus ? buildRouteFilters(departures) : []),
    [departures, isBus]
  );
  const platformFilters = useMemo(
    () => (!isBus ? buildPlatformFilters(departures) : []),
    [departures, isBus]
  );
  const filters = routeFilters.length > 0 ? routeFilters : platformFilters;

  const defaultFilter = routeFilter
    ? routeFilters.includes(routeFilter)
      ? routeFilter
      : "All Routes"
    : routeFilters.length > 0
      ? "All Routes"
      : "All Platforms";

  const [filter, setFilter] = useState(defaultFilter);

  const activeFilter = filters.includes(filter) ? filter : defaultFilter;
  const rows = departures.filter((d) =>
    routeFilters.length > 0
      ? matchesRouteFilter(d.route, activeFilter)
      : matchesPlatformFilter(d.platform, activeFilter)
  );

  const statusLine = sourceLabel(scheduleSource, !!isError);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScheduleScreenHeader
        title={stationName.replace(/\s+Station$/i, "")}
        subtitle={statusLine}
        onBack={onBack}
        live={live && !isError}
        right={
          <IconBtn label="Refresh departures" onPress={onRefresh}>
            <RefreshCw size={20} color={c.text} strokeWidth={2} />
          </IconBtn>
        }
        below={
          filters.length > 1 ? (
            <>
              {filters.map((f) => (
                <Chip key={f} label={f} active={activeFilter === f} onPress={() => setFilter(f)} />
              ))}
            </>
          ) : undefined
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: SPACING.screen, marginBottom: 10 }}>
            <ScheduleDepartureCard departure={item} />
          </View>
        )}
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: getStackContentClearance(insets.bottom),
          flexGrow: rows.length === 0 ? 1 : undefined,
        }}
        initialNumToRender={28}
        maxToRenderPerBatch={40}
        windowSize={10}
        removeClippedSubviews
        ListHeaderComponent={
          station?.lat != null && station?.lon != null ? (
            <View style={{ paddingHorizontal: SPACING.screen, paddingBottom: 12 }}>
              <LiveTrackingMap
                lat={station.lat}
                lng={station.lon}
                mode={station.mode === "lightrail" ? "light_rail" : station.mode}
                stop={{
                  id: stationId,
                  name: stationName,
                  mode: station.mode,
                }}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <DepartureLoadingRows count={6} />
          ) : (
            <EmptyState
              title={isError ? "Departures unavailable" : "No departures"}
              message={
                isError
                  ? "Check your connection and pull to refresh."
                  : activeFilter !== "All Platforms" && activeFilter !== "All Routes"
                    ? `No services for ${activeFilter} right now.`
                    : "No more services scheduled for this stop."
              }
            />
          )
        }
        ListFooterComponent={
          <View style={{ marginTop: SPACING.section, paddingHorizontal: SPACING.screen }}>
            <GroupedList inset={0}>
              <Cell onPress={() => router.push(`/station/${stationId}` as never)}>
                <Info size={20} color={c.primary} strokeWidth={2} />
                <Txt size={14} weight="500" color={c.text} style={{ flex: 1, marginLeft: SPACING.iconGap }}>
                  Station Information
                </Txt>
                <ChevronRight size={18} color={c.textSecondary} strokeWidth={2} />
              </Cell>
            </GroupedList>
          </View>
        }
      />
    </View>
  );
}
