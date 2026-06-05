import { useEffect } from "react";
import * as Location from "expo-location";
import { useStore } from "../store/store";

const SYDNEY_CBD = { lat: -33.8688, lng: 151.2093 };

export function useLocation() {
  const userLocation = useStore((state) => state.userLocation);
  const updateLocation = useStore((state) => state.updateLocation);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          updateLocation(current.coords.latitude, current.coords.longitude);

          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 30_000,
              distanceInterval: 120,
            },
            (location) => {
              updateLocation(location.coords.latitude, location.coords.longitude);
            }
          );
        } else {
          updateLocation(SYDNEY_CBD.lat, SYDNEY_CBD.lng);
        }
      } catch {
        updateLocation(SYDNEY_CBD.lat, SYDNEY_CBD.lng);
      }
    })();

    return () => subscription?.remove();
  }, [updateLocation]);

  return userLocation ?? SYDNEY_CBD;
}
