import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeBackHandler } from "../components/SafeBackHandler";
import { SplashScreen } from "../components/SplashScreen";
import { scheduleDeparturesSeed } from "../database/departureSeed";
import { fetchAppConfig } from "../services/appConfigService";
import { fetchCoreStationsFromApi } from "../services/stationsService";
import { initDatabase } from "../database/db";
import {
  getSavedStationsFromDb,
  getSavedTripsFromDb,
} from "../database/repository";
import { PALETTE } from "../constants/design";
import { logApiConfigStartup } from "../config/api";
import { useStore } from "../store/store";
import { hideNativeSplash, prepareNativeSplash } from "../utils/nativeSplash";
import { DeferredStartupEffects } from "./DeferredStartupEffects";

/** DB/API hydrate in background; no branded overlay (same instant paint as web). */
const SPLASH_MAX_MS = 500;

function hydrateStoreFromDb(
  dbFavorites: { station_id: string; station_name: string; transit_mode: string }[],
  dbTrips: Record<string, unknown>[]
) {
  if (dbFavorites.length > 0) {
    useStore.setState({
      favorites: dbFavorites.map((f) => ({
        station_id: f.station_id,
        station_name: f.station_name,
        transit_mode: f.transit_mode as "train",
      })),
    });
  }

  if (dbTrips.length > 0) {
    useStore.setState({
      savedTrips: dbTrips.map((t) => ({
        id: t.id as string,
        origin_id: t.origin_id as string,
        origin_name: t.origin_name as string,
        destination_id: t.destination_id as string,
        destination_name: t.destination_name as string,
        transit_mode: t.transit_mode as "train",
        route_number: t.route_number as string | undefined,
        description: t.description as string | undefined,
        frequency: t.frequency as string | undefined,
      })),
    });
  }
}

export function AppBootstrap({ children }: { children: ReactNode }) {
  const isDark = useStore((s) => s.theme) === "dark";
  const queryClient = useQueryClient();
  const [showOverlay, setShowOverlay] = useState(false);
  const [deferredReady, setDeferredReady] = useState(true);
  const dismissedRef = useRef(false);

  const dismissSplash = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setShowOverlay(false);
    setDeferredReady(true);
    void hideNativeSplash();
  };

  useEffect(() => {
    logApiConfigStartup();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      if (Platform.OS !== "web") {
        await prepareNativeSplash();
        if (!cancelled) void hideNativeSplash();
      }
      if (cancelled) return;

      void queryClient.prefetchQuery({
        queryKey: ["appConfig"],
        queryFn: fetchAppConfig,
      });

      dismissSplash();
      maxTimer = setTimeout(() => {
        if (!cancelled) dismissSplash();
      }, SPLASH_MAX_MS);
    })();

    void (async () => {
      try {
        await initDatabase();
        if (cancelled) return;

        const [dbFavorites, dbTrips] = await Promise.all([
          getSavedStationsFromDb(),
          getSavedTripsFromDb(),
        ]);
        if (cancelled) return;

        hydrateStoreFromDb(dbFavorites, dbTrips);
        const seedStationIds = [
          ...dbFavorites.map((f) => f.station_id),
          ...dbTrips.flatMap((t) => [
            String(t.origin_id ?? ""),
            String(t.destination_id ?? ""),
          ]),
        ];
        scheduleDeparturesSeed(seedStationIds);
        void fetchCoreStationsFromApi().catch(() => null);
      } catch {
        // App still usable with API + defaults
      }
    })();

    return () => {
      cancelled = true;
      if (maxTimer) clearTimeout(maxTimer);
    };
  }, [queryClient]);

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE[isDark ? "dark" : "light"].bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeBackHandler />
      {children}
      {deferredReady ? <DeferredStartupEffects /> : null}
      <SplashScreen visible={showOverlay} />
    </View>
  );
}
