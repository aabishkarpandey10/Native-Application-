import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useSafeBack } from "../../hooks/useSafeBack";
import { navigationCanPop } from "../../utils/navigationBack";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { ChevronLeft, ChevronRight, Map as MapIcon, MapPin, RefreshCw } from "lucide-react-native";
import {
  DepartureRow,
  DepartureLoadingRows,
  EmptyState,
  GroupedList,
  IconBtn,
  Page,
  SectionHeader,
  Txt,
} from "../../components/design";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import { NEARBY_STATIONS, type SampleDeparture } from "../../constants/sampleData";
import { useColors } from "../../hooks/useColors";
import { useDepartures } from "../../hooks/useDepartures";
import { useLocation } from "../../hooks/useLocation";
import { useLocationLabel } from "../../hooks/useLocationLabel";
import { useNearbyStops } from "../../hooks/useNearbyStops";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { departuresToDisplay } from "../../utils/displayAdapters";

const DEFAULT_LOCATION = { lat: -33.8688, lng: 151.2093 };

function fmtDistance(m: number): string {
  if (!Number.isFinite(m)) return "";
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)} km`;
}

interface NearbyStation {
  id: string;
  name: string;
  distance: string;
  fallback: SampleDeparture[];
}

function NearestBoard({ station }: { station: NearbyStation }) {
  const router = useRouter();
  const { data, isLoading, isError } = useDepartures(station.id, 8);

  const departures = useMemo(
    () =>
      data?.departures && data.departures.length > 0
        ? departuresToDisplay(data.departures).slice(0, 6)
        : station.fallback.slice(0, 6),
    [data?.departures, station.fallback]
  );

  return (
    <>
      <SectionHeader title={`Nearest — ${station.name}`} />
      {isLoading && departures.length === 0 ? (
        <DepartureLoadingRows count={4} />
      ) : isError && departures.length === 0 ? (
        <EmptyState
          title="Could not load departures"
          message="Pull down to refresh or check your connection."
        />
      ) : (
        <GroupedList flat inset={0}>
          {departures.map((d) => (
            <DepartureRow
              key={d.id}
              departure={d}
              flat
              minHeight={62}
              onPress={() => router.push(`/departures?stationId=${station.id}` as never)}
            />
          ))}
          <Pressable
            onPress={() => router.push(`/departures?stationId=${station.id}` as never)}
            style={{ padding: 14, alignItems: "center", backgroundColor: "transparent" }}
          >
            <Txt size={15} weight="600" color="#0079C1">
              View full timetable
            </Txt>
          </Pressable>
        </GroupedList>
      )}
    </>
  );
}

function StopRow({ station }: { station: NearbyStation }) {
  const c = useColors();
  const router = useRouter();
  const { data } = useDepartures(station.id, 1);
  const next = data?.departures?.[0];
  const nextDisplay = next ? departuresToDisplay([next])[0] : station.fallback[0];

  return (
    <Pressable
      onPress={() => router.push(`/departures?stationId=${station.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${station.name}, ${station.distance}. Open timetable.`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: MIN_TOUCH + 4,
        paddingHorizontal: SPACING.screen,
        backgroundColor: c.card,
        opacity: pressed ? 0.65 : 1,
        borderBottomWidth: 0.5,
        borderBottomColor: c.separator,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={17} weight="600" color={c.text}>
          {station.name}
        </Txt>
        <Txt size={14} color={c.textSecondary} style={{ marginTop: 2 }}>
          {station.distance}
          {nextDisplay ? ` · ${nextDisplay.route} to ${nextDisplay.destination}` : ""}
        </Txt>
      </View>
      {nextDisplay ? (
        <Txt size={17} weight="600" color={c.text} tabularNums style={{ marginRight: 4 }}>
          {nextDisplay.clock ?? "—"}
        </Txt>
      ) : null}
      <ChevronRight size={20} color={c.textSecondary} strokeWidth={2} />
    </Pressable>
  );
}

export default function NearbyScreen() {
  const c = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const goBack = useSafeBack("/(tabs)/tools");
  const queryClient = useQueryClient();
  const gps = useLocation();
  const loc = gps ?? DEFAULT_LOCATION;
  const locationLabel = useLocationLabel(loc.lat, loc.lng);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationDenied(status !== "granted");
    });
  }, []);

  const { data: nearbyStops, isLoading, refetch: refetchNearby } = useNearbyStops(loc.lat, loc.lng, 2000);

  const onRefresh = useCallback(async () => {
    await refetchNearby();
    await queryClient.invalidateQueries({ queryKey: ["departures"] });
  }, [refetchNearby, queryClient]);

  const { refreshControl } = useRefreshControl(onRefresh);

  const stations = useMemo<NearbyStation[]>(() => {
    if (nearbyStops && nearbyStops.length > 0) {
      return nearbyStops.slice(0, 8).map((s: any) => ({
        id: String(s.station_id),
        name: String(s.station_name).replace(/\s+Station$/i, ""),
        distance: fmtDistance(Number(s.distance_meters)),
        fallback: [],
      }));
    }
    return NEARBY_STATIONS.map((s) => ({ id: s.id, name: s.name, distance: s.distance, fallback: s.departures }));
  }, [nearbyStops]);

  const nearest = stations[0];
  const otherStops = nearest ? stations.slice(1) : stations;
  const usingDemoData = !nearbyStops || nearbyStops.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title="Stops"
        left={
          navigationCanPop(navigation) ? (
            <Pressable onPress={goBack} style={{ width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: "center" }}>
              <ChevronLeft size={26} color={c.text} strokeWidth={2.2} />
            </Pressable>
          ) : undefined
        }
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACING.screen,
          paddingBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <MapPin size={14} color={c.textSecondary} strokeWidth={2.2} />
          <Txt size={14} color={c.textSecondary} numberOfLines={1}>
            {locationLabel}
            {locationDenied ? " · location off" : ""}
          </Txt>
        </View>
        <View style={{ flexDirection: "row" }}>
          <IconBtn
            label="Map"
            onPress={() => router.push({ pathname: "/map", params: { mode: "view" } } as never)}
          >
            <MapIcon size={22} color={c.primary} strokeWidth={2} />
          </IconBtn>
          <IconBtn label="Refresh" onPress={onRefresh}>
            <RefreshCw size={22} color={c.primary} strokeWidth={2} />
          </IconBtn>
        </View>
      </View>

      <Page refreshControl={refreshControl}>
        {locationDenied ? (
          <Pressable
            onPress={() => Linking.openSettings()}
            style={{
              marginHorizontal: SPACING.screen,
              marginTop: SPACING.section,
              padding: 12,
              backgroundColor: c.card,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.separator,
            }}
          >
            <Txt size={14} color={c.textSecondary}>
              Location is off — tap to open Settings and enable it for nearby stops.
            </Txt>
          </Pressable>
        ) : null}

        {usingDemoData && !isLoading ? (
          <Txt size={13} color={c.textSecondary} style={{ paddingHorizontal: SPACING.screen, paddingTop: 8 }}>
            Showing sample stops — start the backend for live nearby data.
          </Txt>
        ) : null}

        {isLoading && stations.length === 0 ? (
          <DepartureLoadingRows count={5} />
        ) : null}

        {nearest ? <NearestBoard station={nearest} /> : null}

        <SectionHeader title="Nearby stops" />
        {otherStops.length === 0 && !nearest ? (
          <EmptyState
            title="No stops found"
            message="Try moving closer to a station or pull to refresh."
          />
        ) : (
          <View
            style={{
              backgroundColor: c.card,
              borderTopWidth: 0.5,
              borderBottomWidth: 0.5,
              borderColor: c.separator,
            }}
          >
            {otherStops.map((station) => (
              <StopRow key={station.id} station={station} />
            ))}
          </View>
        )}
      </Page>
    </View>
  );
}
