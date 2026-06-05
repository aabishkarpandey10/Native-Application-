import { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Info, RefreshCw } from "lucide-react-native";
import { Cell, Chip, DepartureLoadingRows, DepartureRow, EmptyState, GroupedList, IconBtn, NavBar, Txt } from "../design";
import { SPACING, TAB_BAR_HEIGHT } from "../../constants/design";
import type { SampleDeparture } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { useStationById } from "../../hooks/useStationById";
import { LiveTrackingMap } from "../live/LiveTrackingMap";

interface TimetableViewProps {
  stationName: string;
  stationId?: string;
  departures: SampleDeparture[];
  onBack?: () => void;
  loading?: boolean;
  isError?: boolean;
  onRefresh?: () => void;
  live?: boolean;
  /** Backend feed source: tfnsw-live, timetable-pdf, cached, mock, … */
  scheduleSource?: string | null;
}

function sourceLabel(source: string | null | undefined, isError: boolean): string {
  if (isError) return "Could not load departures — pull to refresh";
  if (source === "timetable-pdf-weekday") {
    return "Weekday PDF timetable · live board preferred on weekends";
  }
  if (source === "tfnsw-live+timetable-pdf-fullday") {
    return "Full day · Transport NSW timetable + live updates";
  }
  if (source === "timetable-pdf-fullday") {
    return "Full day timetable · Transport NSW";
  }
  if (source === "timetable-pdf") return "Scheduled weekday times · PDF timetable";
  if (source === "tfnsw-live+timetable-pdf") {
    return "Live + scheduled timetable · Transport NSW";
  }
  if (source === "tfnsw-live" || source === "live" || source === "tfnsw") return "Live departures · TfNSW";
  if (source === "cached") return "Cached departures · offline";
  if (source === "mock") return "Sample departures · demo mode";
  return "Upcoming departures";
}

/** Build platform filter chips from live departure data (not hardcoded ranges). */
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

export function TimetableView({
  stationName,
  stationId = "CENTRAL_T",
  departures,
  onBack,
  loading,
  isError,
  onRefresh,
  live = true,
  scheduleSource = null,
}: TimetableViewProps) {
  const c = useColors();
  const router = useRouter();
  const { data: station } = useStationById(stationId);

  const { refreshControl } = useRefreshControl(async () => {
    onRefresh?.();
  });

  const filters = useMemo(() => buildPlatformFilters(departures), [departures]);
  const [filter, setFilter] = useState("All Platforms");

  const activeFilter = filters.includes(filter) ? filter : "All Platforms";
  const rows = departures.filter((d) => matchesPlatformFilter(d.platform, activeFilter));

  const statusLine = sourceLabel(scheduleSource, !!isError);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <NavBar
        title={stationName.replace(/\s+Station$/i, "")}
        primary
        onBack={onBack}
        subtitle={
          <Txt size={14} color="rgba(255,255,255,0.9)">
            {statusLine}
          </Txt>
        }
        right={
          <IconBtn label="Refresh departures" onPress={onRefresh}>
            <RefreshCw size={22} color="#FFFFFF" strokeWidth={2} />
          </IconBtn>
        }
        below={
          filters.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 16 }}
            >
              {filters.map((f) => (
                <Chip key={f} label={f} active={activeFilter === f} onPress={() => setFilter(f)} />
              ))}
            </ScrollView>
          ) : null
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DepartureRow departure={item} flat minHeight={62} />}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 24, flexGrow: rows.length === 0 ? 1 : undefined }}
        initialNumToRender={28}
        maxToRenderPerBatch={40}
        windowSize={10}
        removeClippedSubviews
        ListHeaderComponent={
          station?.lat != null && station?.lon != null ? (
            <View style={{ paddingHorizontal: SPACING.screen, paddingTop: 8, paddingBottom: 4 }}>
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
                  : activeFilter !== "All Platforms"
                    ? `Nothing on ${activeFilter} right now.`
                    : "No more services scheduled for this stop."
              }
            />
          )
        }
        ListFooterComponent={
          <View style={{ marginTop: SPACING.section }}>
            <GroupedList>
              <Cell onPress={() => router.push(`/station/${stationId}` as never)}>
                <Info size={20} color={c.primary} strokeWidth={2} />
                <Txt size={14} weight="500" color={c.text} style={{ flex: 1, marginLeft: 12 }}>
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
