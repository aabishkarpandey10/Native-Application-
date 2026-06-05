import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ServiceAlert } from "../services/tfnsw";
import {
  addRecentSearchToDb,
  removeStationFromDb,
  removeTripFromDb,
  saveStationToDb,
  saveTripToDb,
} from "../database/repository";

export interface SavedStation {
  station_id: string;
  station_name: string;
  transit_mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  latitude?: number;
  longitude?: number;
}

export interface SavedTrip {
  id: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  transit_mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  route_number?: string;
  description?: string;
  frequency?: string;
}

export interface AlarmTrip {
  id: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  transit_mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  route_number?: string;
  /** ISO — when you plan to travel / service departs */
  departAt: string;
  /** Notify this many minutes before departAt */
  leadMinutes: number;
  label?: string;
  enabled: boolean;
  createdAt: string;
}

export interface AlarmTripDraft {
  origin_id?: string;
  origin_name?: string;
  destination_id?: string;
  destination_name?: string;
  transit_mode?: AlarmTrip['transit_mode'];
  route_number?: string;
  departAt?: string;
  leadMinutes: number;
  label: string;
}

export type WatchComplication = 'next_departure' | 'nearest' | 'saved_trip' | 'trip_alarm';
export type WatchRefreshMinutes = 1 | 5 | 15;

export interface WatchSettings {
  /** Mirror phone data to Apple Watch / Wear OS when companion is available */
  syncEnabled: boolean;
  complication: WatchComplication;
  /** Favorite stop shown on watch face (when complication is next_departure) */
  primaryStopId: string | null;
  syncFavorites: boolean;
  syncSavedTrips: boolean;
  syncTripAlarms: boolean;
  syncServiceAlerts: boolean;
  hapticOnAlarm: boolean;
  refreshMinutes: WatchRefreshMinutes;
}

export const DEFAULT_WATCH_SETTINGS: WatchSettings = {
  syncEnabled: true,
  complication: 'next_departure',
  primaryStopId: null,
  syncFavorites: true,
  syncSavedTrips: true,
  syncTripAlarms: true,
  syncServiceAlerts: true,
  hapticOnAlarm: true,
  refreshMinutes: 5,
};

const defaultAlarmDraft = (): AlarmTripDraft => ({
  leadMinutes: 15,
  label: "",
  departAt: defaultDepartIso(),
});

function defaultDepartIso(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 45);
  d.setSeconds(0, 0);
  return d.toISOString();
}

interface AppState {
  favorites: SavedStation[];
  savedTrips: SavedTrip[];
  alarmTrips: AlarmTrip[];
  alarmDraft: AlarmTripDraft;
  watchSettings: WatchSettings;
  recentSearches: string[];
  userLocation: { lat: number; lng: number } | null;
  alerts: ServiceAlert[];
  offlineMode: boolean;
  theme: "light" | "dark";
  enableNotifications: boolean;
  displayName: string;
  /** True after first-time apply of admin notification default */
  remoteSettingsApplied: boolean;

  addFavorite: (station: SavedStation) => void;
  removeFavorite: (stationId: string) => void;
  addSavedTrip: (trip: SavedTrip) => void;
  removeSavedTrip: (tripId: string) => void;
  swapSavedTrip: (tripId: string) => void;
  addAlarmTrip: (alarm: AlarmTrip) => void;
  updateAlarmTrip: (alarm: AlarmTrip) => void;
  removeAlarmTrip: (alarmId: string) => void;
  setAlarmDraft: (patch: Partial<AlarmTripDraft>) => void;
  resetAlarmDraft: (seed?: Partial<AlarmTripDraft>) => void;
  setWatchSettings: (patch: Partial<WatchSettings>) => void;
  setTheme: (theme: "light" | "dark") => void;
  updateLocation: (lat: number, lng: number) => void;
  cacheAlerts: (alerts: ServiceAlert[]) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setOfflineMode: (offline: boolean) => void;
  setEnableNotifications: (enabled: boolean) => void;
  setDisplayName: (name: string) => void;
  markRemoteSettingsApplied: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      favorites: [],
      savedTrips: [],
      alarmTrips: [],
      alarmDraft: defaultAlarmDraft(),
      watchSettings: { ...DEFAULT_WATCH_SETTINGS },
      recentSearches: [],
      userLocation: null,
      alerts: [],
      offlineMode: false,
      theme: "dark",
      enableNotifications: false,
      displayName: "Commuter",
      remoteSettingsApplied: false,

      addFavorite: (station) => {
        void saveStationToDb({
          station_id: station.station_id,
          station_name: station.station_name,
          transit_mode: station.transit_mode,
        });
        set((state) => {
          const exists = state.favorites.some((f) => f.station_id === station.station_id);
          if (exists) return state;
          return { favorites: [...state.favorites, station] };
        });
      },

      removeFavorite: (stationId) => {
        void removeStationFromDb(stationId);
        set((state) => ({
          favorites: state.favorites.filter((s) => s.station_id !== stationId),
        }));
      },

      addSavedTrip: (trip) => {
        set((state) => {
          const exists = state.savedTrips.some(
            (t) => t.origin_id === trip.origin_id && t.destination_id === trip.destination_id
          );
          if (exists) return state;
          void saveTripToDb(trip);
          return { savedTrips: [...state.savedTrips, trip] };
        });
      },

      removeSavedTrip: (tripId) => {
        void removeTripFromDb(tripId);
        set((state) => ({
          savedTrips: state.savedTrips.filter((t) => t.id !== tripId),
        }));
      },

      swapSavedTrip: (tripId) =>
        set((state) => ({
          savedTrips: state.savedTrips.map((t) => {
            if (t.id !== tripId) return t;
            return {
              ...t,
              origin_id: t.destination_id,
              origin_name: t.destination_name,
              destination_id: t.origin_id,
              destination_name: t.origin_name,
            };
          }),
        })),

      addAlarmTrip: (alarm) =>
        set((state) => ({
          alarmTrips: [...state.alarmTrips.filter((a) => a.id !== alarm.id), alarm],
        })),

      updateAlarmTrip: (alarm) =>
        set((state) => ({
          alarmTrips: state.alarmTrips.map((a) => (a.id === alarm.id ? alarm : a)),
        })),

      removeAlarmTrip: (alarmId) =>
        set((state) => ({
          alarmTrips: state.alarmTrips.filter((a) => a.id !== alarmId),
        })),

      setAlarmDraft: (patch) =>
        set((state) => ({
          alarmDraft: { ...state.alarmDraft, ...patch },
        })),

      resetAlarmDraft: (seed) =>
        set({
          alarmDraft: { ...defaultAlarmDraft(), ...seed },
        }),

      setWatchSettings: (patch) =>
        set((state) => ({
          watchSettings: { ...state.watchSettings, ...patch },
        })),

      setTheme: (theme) => set({ theme }),

      updateLocation: (lat, lng) =>
        set({ userLocation: { lat, lng } }),

      cacheAlerts: (alerts) => set({ alerts }),

      addRecentSearch: (search) => {
        void addRecentSearchToDb(search);
        set((state) => ({
          recentSearches: [
            search,
            ...state.recentSearches.filter((s) => s !== search),
          ].slice(0, 10),
        }));
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      setOfflineMode: (offline) => set({ offlineMode: offline }),
      setEnableNotifications: (enabled) => set({ enableNotifications: enabled }),
      setDisplayName: (displayName) => set({ displayName }),
      markRemoteSettingsApplied: () => set({ remoteSettingsApplied: true }),
    }),
    {
      name: "sydney-transit-store-ref",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favorites: state.favorites,
        savedTrips: state.savedTrips,
        alarmTrips: state.alarmTrips,
        watchSettings: state.watchSettings,
        theme: state.theme,
        recentSearches: state.recentSearches,
        displayName: state.displayName,
        enableNotifications: state.enableNotifications,
      }),
    }
  )
);
export default useStore;
