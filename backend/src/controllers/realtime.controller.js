import { getDeparturesWithCache, testTfnswConnection, isOutageMode } from "../services/tfnswIngestion.service.js";
import { getDataSourceMeta } from "../services/cache.service.js";

export async function getRealtimeDepartures(req, res, next) {
  try {
    const stationId = req.query.stationId || req.params.stopId;
    if (!stationId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "stationId required" });
    }
    const data = await getDeparturesWithCache(String(stationId));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getRealtimeStatus(_req, res) {
  const tfnswLive = await testTfnswConnection();
  const meta = getDataSourceMeta();
  res.json({
    ok: true,
    tfnswLive,
    outageMode: isOutageMode(),
    ...meta,
    dataSource: tfnswLive ? "transport.nsw.gov.au" : meta.tfnswConfigured ? "mock-fallback" : "mock",
  });
}
