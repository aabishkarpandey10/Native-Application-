import { getServiceAlerts } from "./alertsService.js";
import { buildLiveBoardByMode } from "./aiLiveBoard.js";

/**
 * Refresh alerts + live departures on every AI request (don't trust stale client cache).
 */
export async function enrichAiContext(clientContext = {}, apiKey, tfnswLive) {
  const { alerts } = await getServiceAlerts(apiKey, { forceRefresh: true });
  const lat = Number(clientContext.userLocation?.lat) || -33.8688;
  const lng = Number(clientContext.userLocation?.lng) || 151.2093;
  const favorites = clientContext.favorites || [];
  const now = clientContext.currentTime ? new Date(clientContext.currentTime) : new Date();

  const board = await buildLiveBoardByMode({
    lat,
    lng,
    apiKey,
    favorites,
  });

  return {
    ...clientContext,
    currentTime: now.toISOString(),
    recentAlerts: alerts,
    liveSnapshot: {
      asOf: board.asOf,
      tfnswLive: !!tfnswLive && board.tfnswLive,
      dataSource: board.dataSource,
      nearby: board.nearby,
      favorites: board.favorites,
      byMode: board.byMode,
      alertsByMode: board.alertsByMode,
    },
  };
}
