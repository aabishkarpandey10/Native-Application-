import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { unstable_createElement as createElement } from "react-native-web";
import type { VehiclePosition } from "../../services/tfnsw";
export interface MapStop {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  transit_mode: string;
}

export interface TransitMapProps {
  userLat: number;
  userLon: number;
  stops: MapStop[];
  vehicles: VehiclePosition[];
  onStopPress?: (stopId: string) => void;
}

function buildMapHtml(
  userLat: number,
  userLon: number,
  stops: MapStop[],
  vehicles: VehiclePosition[]
): string {
  const stopsJson = JSON.stringify(stops);
  const vehiclesJson = JSON.stringify(vehicles);
  const colorsJson = JSON.stringify({
    train: "#F6891F",
    metro: "#0095A0",
    ferry: "#52B848",
    light_rail: "#E62B1E",
    bus: "#00B5E2",
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #1A1A1F; }
    .leaflet-control-attribution { font-size: 9px; opacity: 0.6; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const userLat = ${userLat};
    const userLon = ${userLon};
    const stops = ${stopsJson};
    const vehicles = ${vehiclesJson};
    const modeColors = ${colorsJson};

    function modeColor(mode, route) {
      const m = (mode || '').toLowerCase().replace(/_/g, '');
      const r = (route || '').toUpperCase();
      if (m === 'train' || r.startsWith('T')) return modeColors.train;
      if (m === 'metro' || r.startsWith('M')) return modeColors.metro;
      if (m === 'ferry' || r.startsWith('F')) return modeColors.ferry;
      if (m === 'lightrail' || m === 'lightrail' || r.startsWith('L')) return modeColors.light_rail;
      return modeColors.bus;
    }

    const map = L.map('map', { zoomControl: false }).setView([userLat, userLon], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.circleMarker([userLat, userLon], {
      radius: 8, color: '#0A84FF', fillColor: '#0A84FF', fillOpacity: 0.35, weight: 2
    }).bindPopup('Your location').addTo(map);

    const bounds = [[userLat, userLon]];
    stops.forEach(function(s) {
      const color = modeColor(s.transit_mode);
      const m = L.circleMarker([s.latitude, s.longitude], {
        radius: 9, color: '#fff', fillColor: color, fillOpacity: 0.9, weight: 2
      }).bindPopup('<strong>' + s.station_name + '</strong>').addTo(map);
      m.on('click', function() {
        window.parent.postMessage({ type: 'stop-press', stationId: s.station_id }, '*');
      });
      bounds.push([s.latitude, s.longitude]);
    });

    vehicles.forEach(function(v) {
      const color = modeColor(v.mode, v.routeNumber);
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:' + color + ';color:#fff;font-size:10px;font-weight:700;padding:3px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.5);">' + v.routeNumber + '</div>',
        iconSize: [40, 20], iconAnchor: [20, 10]
      });
      L.marker([v.lat, v.lon], { icon: icon }).addTo(map);
      bounds.push([v.lat, v.lon]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
  </script>
</body>
</html>`;
}

export function TransitMap({
  userLat,
  userLon,
  stops,
  vehicles,
  onStopPress,
}: TransitMapProps) {
  const html = useMemo(
    () => buildMapHtml(userLat, userLon, stops, vehicles),
    [userLat, userLon, stops, vehicles]
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "stop-press" && event.data.stationId) {
        onStopPress?.(event.data.stationId as string);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onStopPress]);

  return (
    <View style={styles.wrap}>
      {createElement("iframe", {
        title: "Transit map",
        srcDoc: html,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
