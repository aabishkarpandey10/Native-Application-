import { useMemo } from "react";
import { Platform, Text, View } from "react-native";
import type { MapStop, TransitMapProps } from "./TransitMap.web";

let MapView: React.ComponentType<Record<string, unknown>> | undefined;
let Marker: React.ComponentType<Record<string, unknown>> | undefined;
let PROVIDER_DEFAULT: string | undefined;

try {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
} catch {
  // react-native-maps not linked (e.g. Expo Go limitations on some builds)
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1A1A1F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8E8E93" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2C2C32" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A0A0C" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function modePinColor(mode: string): string {
  const m = mode.toLowerCase().replace(/_/g, "");
  if (m === "metro") return "#0095A0";
  if (m === "ferry") return "#52B848";
  if (m === "lightrail" || m === "lightrail") return "#E62B1E";
  if (m === "bus") return "#00B5E2";
  return "#F6891F";
}

export function TransitMap({
  userLat,
  userLon,
  stops,
  vehicles,
  onStopPress,
}: TransitMapProps) {
  const initialRegion = useMemo(
    () => ({
      latitude: userLat,
      longitude: userLon,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [userLat, userLon]
  );

  if (!MapView || !Marker) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1A1A1F" }}>
        <Text style={{ color: "#8E8E93", fontSize: 14, textAlign: "center", paddingHorizontal: 24 }}>
          Map requires a development build with react-native-maps.{"\n"}
          Use the station list or run: npx expo run:ios / run:android
        </Text>
      </View>
    );
  }

  return (
    <MapView
      style={{ width: "100%", height: "100%" }}
      provider={PROVIDER_DEFAULT}
      customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
      userInterfaceStyle="dark"
      initialRegion={initialRegion}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
    >
      {stops.map((stop) => (
        <Marker
          key={stop.station_id}
          coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
          title={stop.station_name}
          description={stop.transit_mode}
          pinColor={modePinColor(stop.transit_mode)}
          onPress={() => onStopPress?.(stop.station_id)}
        />
      ))}
      {vehicles.map((v) => (
        <Marker
          key={v.id}
          coordinate={{ latitude: v.lat, longitude: v.lon }}
          title={`${v.routeNumber} · Live`}
          description={v.mode}
          pinColor={modePinColor(v.mode)}
          rotation={v.bearing != null && Number.isFinite(v.bearing) ? v.bearing : 0}
        />
      ))}
    </MapView>
  );
}

export type { MapStop, TransitMapProps };
