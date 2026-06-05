import { useEffect, useState } from "react";

/** Re-render on an interval so live countdown labels stay accurate. */
export function useMinuteTicker(intervalMs = 15_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
