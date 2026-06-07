import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useSafeBack } from "../../hooks/useSafeBack";
import { navigationCanPop } from "../../utils/navigationBack";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { ChevronRight, Map as MapIcon, MapPin, RefreshCw } from "lucide-react-native";
import {
  BackButton,
  DepartureLoadingRows,
  EmptyState,
  IconBtn,
  Page,
  SectionHeader,
  Txt,
} from "../../components/design";
import { ScheduleBoard, ScheduleDepartureCard } from "../../components/schedule";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { MIN_TOUCH, SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { useDepartures } from "../../hooks/useDepartures";
import { useLocation } from "../../hooks/useLocation";
import { useLocationLabel } from "../../hooks/useLocationLabel";
import { useNearbyStops } from "../../hooks/useNearbyStops";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { ApiRequestError } from "../../services/apiClient";
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
}

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "Could not reach the Sydney Transit API.";
}

function NearestBoard({ station }: { station: NearbyStation }) {
  const c = useColors();
  const router = useRouter();
  const { data, isLoading, isError, error } = useDepartures(station.id, 8);

  const departures = useMemo(
    () => (data?.departures ? departuresToDisplay(data.departures).slice(0, 6) : []),
    [data?.departures]
  );

  return (
    <>
      <SectionHeader title={`Nearest — ${station.name}`} />
      {isLoading && departures.length === 0 ? (
        <DepartureLoadingRows count={4} />
      ) : isError && departures.length === 0 ? (
        <EmptyState
          title="Could not load departures"
          message={apiErrorMessage(error)}
        />
      ) : departures.length === 0 ? (
        <EmptyState title="No departures" message="No upcoming services for this stop." />
      ) : (
        <View>
          <ScheduleBoard>
            {departures.map((d) => (
              <ScheduleDepartureCard
                key={d.id}
                departure={d}
                onPress={() => router.push(`/departures?stationId=${station.id}` as never)}
              />
            ))}
          </ScheduleBoard>
          <Pressable
            onPress={() => router.push(`/departures?stationId=${station.id}` as never)}
            style={{ padding: SPACING.cell, alignItems: "center" }}
          >
            <Txt size={15} weight="600" color={c.primary}>
              View full timetable
            </Txt>
          </Pressable>
        </View>
      )}
    </>
  );
}

function StopRow({ station }: { station: NearbyStation }) {
  const c = useColors();
  const router = useRouter();
  const { data } = useDepartures(station.id, 1);
  const next = data?.departures?.[0];
  const nextDisplay = next ? departuresToDisplay([next])[0] : null;

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

  const {
    data: nearbyStops,
    isLoading,
    isError,
    error,
    refetch: refetchNearby,
  } = useNearbyStops(loc.lat, loc.lng, 2000);

  const onRefresh = useCallback(async () => {
    await refetchNearby();
    await queryClient.invalidateQueries({ queryKey: ["departures"] });
  }, [refetchNearby, queryClient]);

  const { refreshControl } = useRefreshControl(onRefresh);

  const stations = useMemo<NearbyStation[]>(() => {
    if (!nearbyStops?.length) return [];
    return nearbyStops.slice(0, 8).map((s: { station_id: string; station_name: string; distance_meters: number }) => ({
      id: String(s.station_id),
      name: String(s.station_name).replace(/\s+Station$/i, ""),
      distance: fmtDistance(Number(s.distance_meters)),
    }));
  }, [nearbyStops]);

  const nearest = stations[0];
  const otherStops = nearest ? stations.slice(1) : stations;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title="Stops"
        left={
          navigationCanPop(navigation) ? (
            <BackButton variant="plain" onPress={goBack} />
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

      <Page tabScreen refreshControl={refreshControl}>
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

        {isError ? (
          <EmptyState
            title="Nearby stops unavailable"
            message={apiErrorMessage(error)}
          />
        ) : null}

        {isLoading && stations.length === 0 ? (
          <DepartureLoadingRows count={5} />
        ) : null}

        {!isLoading && !isError && stations.length === 0 ? (
          <EmptyState
            title="No stops found"
            message="Try moving closer to a station or pull to refresh."
          />
        ) : null}

        {nearest ? <NearestBoard station={nearest} /> : null}

        {otherStops.length > 0 ? (
          <>
            <SectionHeader title="Nearby stops" />
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
          </>
        ) : null}
      </Page>
    </View>
  );
}
