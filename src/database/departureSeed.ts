/** Background departure seeding — only favourites / saved-trip stations (not the full network). */

const listeners = new Set<() => void>();

export function onDeparturesSeedComplete(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyDeparturesSeedComplete() {
  listeners.forEach((fn) => fn());
}

let seedPromise: Promise<void> | null = null;

/**
 * Seed SQLite departures for a small set of station IDs (runs after splash).
 * Omit IDs to skip — full-network seed only via refreshAllTransitData().
 */
export function scheduleDeparturesSeed(stationIds: string[] = []): void {
  const unique = [...new Set(stationIds.filter(Boolean))];
  if (!unique.length) return;
  if (seedPromise) return;

  seedPromise = (async () => {
    const { refreshDeparturesInDb } = await import("./repository");
    await refreshDeparturesInDb(undefined, unique);
    notifyDeparturesSeedComplete();
  })().catch(() => {
    seedPromise = null;
  });
}
