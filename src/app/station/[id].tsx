import { useMemo } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeBack } from "../../hooks/useSafeBack";
import { Accessibility, Car, ChevronRight, Star, Wifi, Zap } from "lucide-react-native";
import {
  Cell,
  DepartureLoadingRows,
  DepartureRow,
  EmptyState,
  GroupedList,
  IconBtn,
  LineBadge,
  NavBar,
  Page,
  SectionHeader,
  Txt,
} from "../../components/design";
import { useColors } from "../../hooks/useColors";
import { useDepartures } from "../../hooks/useDepartures";
import { useStore } from "../../store/store";
import { departuresToDisplay } from "../../utils/displayAdapters";
import { normalizeStationId } from "../../constants/stationAliases";
import { useStationById } from "../../hooks/useStationById";
import { LiveTrackingMap } from "../../components/live/LiveTrackingMap";

const FACILITIES = [
  { icon: Accessibility, label: "Step-free access", available: true },
  { icon: Zap, label: "Opal top-up", available: true },
  { icon: Wifi, label: "Free WiFi", available: true },
  { icon: Car, label: "Parking", available: false },
];

export default function StationDetailScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = normalizeStationId(id ?? "CENTRAL_T");
  const { data: station } = useStationById(stationId);
  const stationName = station?.name ?? "Station";

  const favorites = useStore((s) => s.favorites);
  const addFavorite = useStore((s) => s.addFavorite);
  const removeFavorite = useStore((s) => s.removeFavorite);
  const isSaved = favorites.some((f) => f.station_id === stationId);

  const { data, isLoading, isError } = useDepartures(stationId, 8);
  const departures = useMemo(
    () => (data?.departures ? departuresToDisplay(data.departures).slice(0, 6) : []),
    [data?.departures]
  );

  const toggleSave = () => {
    if (isSaved) {
      removeFavorite(stationId);
      return;
    }
    addFavorite({
      station_id: stationId,
      station_name: stationName,
      transit_mode:
        station?.mode === "lightrail"
          ? "light_rail"
          : station?.mode === "ferry" || station?.mode === "metro" || station?.mode === "bus" || station?.mode === "train"
            ? station.mode
            : "train",
      latitude: station?.lat,
      longitude: station?.lon,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <NavBar
        title={stationName.replace(/\s+Station$/i, "")}
        primary
        onBack={goBack}
        right={
          <IconBtn label={isSaved ? "Remove from saved stops" : "Save stop"} onPress={toggleSave}>
            <Star
              size={22}
              color={isSaved ? "#FFD60A" : "#FFFFFF"}
              fill={isSaved ? "#FFD60A" : "transparent"}
              strokeWidth={2}
            />
          </IconBtn>
        }
      />

      <Page>
        {station?.lat != null && station?.lon != null ? (
          <>
            <SectionHeader title="Live tracking" />
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <LiveTrackingMap
                lat={station.lat}
                lng={station.lon}
                mode={
                  station.mode === "lightrail"
                    ? "light_rail"
                    : station.mode
                }
                stop={{
                  id: stationId,
                  name: stationName,
                  mode: station.mode,
                }}
              />
            </View>
          </>
        ) : null}

        <SectionHeader title="Departures" />
        {isLoading ? (
          <DepartureLoadingRows count={4} />
        ) : isError ? (
          <EmptyState title="Departures unavailable" message="Check that the backend is running, then try again." />
        ) : departures.length === 0 ? (
          <EmptyState title="No upcoming departures" message="There may be no more services today at this stop." />
        ) : (
          <GroupedList flat inset={0}>
            {departures.map((d) => (
              <DepartureRow key={d.id} departure={d} flat minHeight={62} />
            ))}
            <Cell
              minHeight={48}
              onPress={() => router.push(`/departures?stationId=${stationId}` as never)}
              style={{ justifyContent: "center" }}
            >
              <Txt size={15} weight="600" color={c.primary} style={{ flex: 1 }}>
                View full timetable
              </Txt>
              <ChevronRight size={18} color={c.primary} strokeWidth={2} />
            </Cell>
          </GroupedList>
        )}

        {station?.mode === "train" ? (
          <>
            <SectionHeader title="Lines" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
              {["T1", "T2", "T3", "T4", "T8", "T9"].map((l) => (
                <LineBadge key={l} route={l} small />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title="Facilities" />
        <GroupedList>
          {FACILITIES.map((f) => {
            const Icon = f.icon;
            return (
              <Cell key={f.label} style={{ opacity: f.available ? 1 : 0.45 }}>
                <Icon size={20} color={c.text} strokeWidth={2} />
                <Txt size={15} color={c.text} style={{ flex: 1, marginLeft: 12 }}>
                  {f.label}
                </Txt>
                <Txt size={14} weight="600" color={f.available ? "#34C759" : c.textSecondary}>
                  {f.available ? "Yes" : "No"}
                </Txt>
              </Cell>
            );
          })}
        </GroupedList>
      </Page>
    </View>
  );
}
