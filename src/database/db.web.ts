import AsyncStorage from "@react-native-async-storage/async-storage";

const SEED_KEY = "db_seeded_v1";

export function isWebFallback() {
  return true;
}

export async function initDatabase(): Promise<void> {
  const { initWebStore } = await import("./webStore");
  await initWebStore();
  await AsyncStorage.setItem(SEED_KEY, "web_fallback");
}

export async function refreshDeparturesInDb(_stationId?: string) {
  const { webRefreshDepartures } = await import("./webStore");
  await webRefreshDepartures();
}
