import { useLocation } from "../hooks/useLocation";

/** Keeps GPS location synced to the global store while the app is open. */
export function LocationWatcher() {
  useLocation();
  return null;
}
