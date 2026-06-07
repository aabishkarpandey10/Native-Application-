import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { useSafeBack } from "../hooks/useSafeBack";
import { TimetableView } from "../components/screens/TimetableView";
import { normalizeStationId } from "../constants/stationAliases";
import { useDepartures } from "../hooks/useDepartures";
import { useStationById } from "../hooks/useStationById";
import { departuresToDisplay } from "../utils/displayAdapters";

export default function DeparturesScreen() {
  const goBack = useSafeBack();
  const { stationId, route } = useLocalSearchParams<{ stationId?: string; route?: string }>();
  const id = normalizeStationId(stationId ?? "CENTRAL_T");
  const routeFilter = String(route ?? "").trim() || undefined;
  const { data: station } = useStationById(id);
  const name = station?.name ?? "Station";
  const { data, isLoading, isFetching, isError, refetchFresh } = useDepartures(id, 5000, {
    fullDay: true,
    route: routeFilter,
  });
  const departures = useMemo(
    () => (data?.departures ? departuresToDisplay(data.departures) : []),
    [data?.departures]
  );
  const live = departures.length > 0 && !isError;

  return (
    <TimetableView
      stationName={name}
      stationId={id}
      routeFilter={routeFilter}
      departures={departures}
      scheduleSource={data?.source ?? null}
      live={live}
      isError={isError}
      loading={isLoading || isFetching}
      onRefresh={() => void refetchFresh()}
      onBack={goBack}
    />
  );
}
