import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { View } from "react-native";
import { Txt } from "../components/design/Txt";
import { SEMANTIC } from "../constants/design";
import { onDeparturesSeedComplete } from "../database/departureSeed";
import { getDbStats } from "../database/repository";
import { useColors } from "../hooks/useColors";

interface DatabaseContextValue {
  ready: boolean;
  stats: { stations: number; departures: number; alerts: number };
  refreshStats: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  ready: false,
  stats: { stations: 0, departures: 0, alerts: 0 },
  refreshStats: async () => {},
});

export function useDatabase() {
  return useContext(DatabaseContext);
}

/** Stats context only — heavy init runs in AppBootstrap for faster first paint. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const [ready] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ stations: 0, departures: 0, alerts: 0 });

  const refreshStats = async () => {
    try {
      setStats(await getDbStats());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshStats().catch(() => setError("Stats unavailable"));
    const unsubscribe = onDeparturesSeedComplete(() => {
      refreshStats().catch(() => {});
    });
    return unsubscribe;
  }, []);

  return (
    <DatabaseContext.Provider value={{ ready, stats, refreshStats }}>
      {error ? (
        <View
          style={{
            backgroundColor: c.isDark ? "rgba(255,149,0,0.12)" : "rgba(255,149,0,0.1)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: c.isDark ? "rgba(255,149,0,0.25)" : "rgba(255,149,0,0.2)",
          }}
        >
          <Txt size={12} weight="500" color={SEMANTIC.warning} style={{ textAlign: "center" }}>
            Offline mode — using cached data ({error})
          </Txt>
        </View>
      ) : null}
      {children}
    </DatabaseContext.Provider>
  );
}
