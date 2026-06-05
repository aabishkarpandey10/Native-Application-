import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_ALERTS,
  generateDeparturesForStation,
  SYDNEY_STATIONS,
} from "./seedData";

const DB_NAME = "sydney_transit.db";
const SEED_KEY = "db_seeded_v1";
const DEPARTURES_CACHE_KEY = "departures_cache_v3";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

export function isWebFallback() {
  return false;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
}

async function runMigrations(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      mode TEXT NOT NULL,
      code TEXT
    );

    CREATE TABLE IF NOT EXISTS departures (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      route_number TEXT NOT NULL,
      destination TEXT NOT NULL,
      mode TEXT NOT NULL,
      platform TEXT,
      scheduled_time TEXT NOT NULL,
      delay_minutes INTEGER DEFAULT 0,
      line_color TEXT,
      line_name TEXT,
      FOREIGN KEY (station_id) REFERENCES stations(id)
    );

    CREATE TABLE IF NOT EXISTS departure_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      departure_id TEXT NOT NULL,
      station_name TEXT NOT NULL,
      stop_time TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (departure_id) REFERENCES departures(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      mode TEXT NOT NULL,
      severity TEXT NOT NULL,
      affected_routes TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_stations (
      station_id TEXT PRIMARY KEY,
      station_name TEXT NOT NULL,
      transit_mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_trips (
      id TEXT PRIMARY KEY,
      origin_id TEXT NOT NULL,
      origin_name TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      destination_name TEXT NOT NULL,
      transit_mode TEXT NOT NULL,
      route_number TEXT,
      description TEXT,
      frequency TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_searches (
      query TEXT PRIMARY KEY,
      searched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_history (
      id TEXT PRIMARY KEY,
      origin_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      duration_minutes INTEGER,
      planned_at TEXT NOT NULL
    );
  `);
}

async function seedDatabase(database: SQLite.SQLiteDatabase) {
  const already = await AsyncStorage.getItem(SEED_KEY);
  if (already === "true") {
    const stationCount = await database.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM stations"
    );
    if (stationCount && stationCount.c > 0) return;
  }

  await database.runAsync("DELETE FROM departure_stops");
  await database.runAsync("DELETE FROM departures");
  await database.runAsync("DELETE FROM alerts");
  await database.runAsync("DELETE FROM stations");

  await database.withTransactionAsync(async () => {
    for (const s of SYDNEY_STATIONS) {
      await database.runAsync(
        `INSERT OR REPLACE INTO stations (id, name, lat, lon, mode, code) VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.name, s.lat, s.lon, s.mode, s.code ?? null]
      );
    }
  });

  // Departures are seeded lazily when a station is opened (faster first launch)

  const now = new Date().toISOString();
  for (const alert of DEFAULT_ALERTS) {
    await database.runAsync(
      `INSERT OR REPLACE INTO alerts (id, title, description, mode, severity, affected_routes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [alert.id, alert.title, alert.description, alert.mode, alert.severity, alert.affected_routes, now]
    );
  }

  const defaultFavorites = [
    { station_id: "CENTRAL_T", station_name: "Central Station", transit_mode: "train" },
    { station_id: "TOWNHALL_T", station_name: "Town Hall Station", transit_mode: "train" },
    { station_id: "CIRCULARQUAY_T", station_name: "Circular Quay Station", transit_mode: "train" },
    { station_id: "CHATSWOOD_T", station_name: "Chatswood Station", transit_mode: "train" },
  ];
  for (const fav of defaultFavorites) {
    await database.runAsync(
      `INSERT OR IGNORE INTO saved_stations (station_id, station_name, transit_mode, created_at) VALUES (?, ?, ?, ?)`,
      [fav.station_id, fav.station_name, fav.transit_mode, now]
    );
  }

  const defaultTrips = [
    {
      id: "trip_central_townhall",
      origin_id: "CENTRAL_T",
      origin_name: "Central Station",
      destination_id: "TOWNHALL_T",
      destination_name: "Town Hall Station",
      transit_mode: "train",
      route_number: "T1",
      description: "Weekday commute",
      frequency: "Every 10 min",
    },
    {
      id: "trip_townhall_bondi",
      origin_id: "TOWNHALL_T",
      origin_name: "Town Hall Station",
      destination_id: "BONDI_T",
      destination_name: "Bondi Junction Station",
      transit_mode: "train",
      route_number: "T4",
      description: "Afternoon trip",
      frequency: "Every 15 min",
    },
    {
      id: "trip_cq_manly",
      origin_id: "CQ_W2",
      origin_name: "Circular Quay Wharf 2",
      destination_id: "MANLY_W",
      destination_name: "Manly Wharf",
      transit_mode: "ferry",
      route_number: "F1",
      description: "Weekend ferry",
      frequency: "Every 20 min",
    },
  ];
  for (const trip of defaultTrips) {
    await database.runAsync(
      `INSERT OR IGNORE INTO saved_trips (id, origin_id, origin_name, destination_id, destination_name, transit_mode, route_number, description, frequency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.id,
        trip.origin_id,
        trip.origin_name,
        trip.destination_id,
        trip.destination_name,
        trip.transit_mode,
        trip.route_number,
        trip.description,
        trip.frequency,
        now,
      ]
    );
  }

  await AsyncStorage.setItem(SEED_KEY, "true");
}

export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const database = await getDatabase();
    await runMigrations(database);
    await seedDatabase(database);
    const cacheVer = await AsyncStorage.getItem(DEPARTURES_CACHE_KEY);
    if (cacheVer !== "3") {
      await database.runAsync("DELETE FROM departure_stops");
      await database.runAsync("DELETE FROM departures");
      await AsyncStorage.setItem(DEPARTURES_CACHE_KEY, "3");
    }
  })();
  return initPromise;
}

export async function refreshDeparturesInDb(stationId?: string, stationIds?: string[]) {
  const database = await getDatabase();
  let stations;
  if (stationId) {
    stations = SYDNEY_STATIONS.filter((s) => s.id === stationId);
  } else if (stationIds?.length) {
    const wanted = new Set(stationIds);
    stations = SYDNEY_STATIONS.filter((s) => wanted.has(s.id));
  } else {
    return;
  }
  if (!stations.length) return;

  for (const station of stations) {
    await database.runAsync(
      "DELETE FROM departure_stops WHERE departure_id IN (SELECT id FROM departures WHERE station_id = ?)",
      [station.id]
    );
    await database.runAsync("DELETE FROM departures WHERE station_id = ?", [station.id]);

    const deps = generateDeparturesForStation(station.id, 6);
    for (const dep of deps) {
      await database.runAsync(
        `INSERT INTO departures (id, station_id, route_number, destination, mode, platform, scheduled_time, delay_minutes, line_color, line_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dep.id,
          dep.station_id,
          dep.route_number,
          dep.destination,
          dep.mode,
          dep.platform,
          dep.scheduled_time,
          dep.delay_minutes,
          dep.line_color,
          dep.line_name,
        ]
      );
      for (const stop of dep.stops) {
        await database.runAsync(
          `INSERT INTO departure_stops (departure_id, station_name, stop_time, sort_order) VALUES (?, ?, ?, ?)`,
          [dep.id, stop.station_name, stop.time, stop.sort_order]
        );
      }
    }
  }
}
