import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { TransitMap } from "../transit-map/TransitMap";
import { Txt } from "../design";
import { useColors } from "../../hooks/useColors";
import { useLiveVehicles } from "../../hooks/useLiveVehicles";
import type { VehiclePosition } from "../../services/tfnsw";
import { LivePulse } from "../ui/LivePulse";

type Props = {
  lat: number;
  lng: number;
  /** train | metro | bus | light_rail | ferry — omit for all modes */
  mode?: string;
  /** Filter to one line (e.g. T1, M1, 400) */
  route?: string;
  radiusM?: number;
  height?: number;
  enabled?: boolean;
  /** Show this stop on the map */
  stop?: { id: string; name: string; mode?: string };
};

function modeLabel(mode?: string): string {
  const m = (mode || "all").replace(/_/g, " ");
  if (m === "all") return "services";
  return m;
}

export function LiveTrackingMap({
  lat,
  lng,
  mode,
  route,
  radiusM = 12_000,
  height = 220,
  enabled = true,
  stop,
}: Props) {
  const c = useColors();
  const { data, isLoading, isFetching, isError } = useLiveVehicles({
    lat,
    lng,
    mode,
    route,
    radiusM,
    enabled,
  });

  const vehicles: VehiclePosition[] = data?.vehicles ?? [];
  const live = data?.tfnswLive === true;

  const mapStops = useMemo(() => {
    if (!stop) return [];
    return [
      {
        station_id: stop.id,
        station_name: stop.name,
        latitude: lat,
        longitude: lng,
        transit_mode: stop.mode ?? mode ?? "train",
      },
    ];
  }, [stop, lat, lng, mode]);

  const statusLine = useMemo(() => {
    if (isError) return "Live tracking unavailable — pull to refresh";
    if (!live && data?.message) return data.message;
    if (!live) return "Configure TFNSW_API_KEY for live vehicle positions";
    if (isLoading && vehicles.length === 0) return "Loading live positions…";
    const routeBit = route ? ` · ${route}` : "";
    const n = vehicles.length;
    return `${n} ${modeLabel(mode)}${routeBit} nearby · updates every 20s`;
  }, [isError, live, data?.message, isLoading, vehicles.length, mode, route]);

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        {live ? <LivePulse color="#30D158" size={8} /> : null}
        <Txt size={13} weight="600" color={c.text}>
          Live tracking
        </Txt>
        {(isLoading || isFetching) && vehicles.length === 0 ? (
          <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: 4 }} />
        ) : null}
      </View>
      <Txt size={12} color={c.textSecondary} style={{ marginBottom: 8, lineHeight: 17 }}>
        {statusLine}
        {live ? " · Source: Transport NSW (transportnsw.info)" : ""}
      </Txt>
      <View style={{ height, borderRadius: 12, overflow: "hidden" }}>
        <TransitMap
          userLat={lat}
          userLon={lng}
          stops={mapStops}
          vehicles={vehicles}
        />
      </View>
    </View>
  );
}
