import { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { useColors } from "./useColors";

/** Pull-to-refresh control for ScrollView / Page. */
export function useRefreshControl(onRefresh: () => void | Promise<void>) {
  const c = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      tintColor={c.primary}
      colors={[c.primary]}
    />
  );

  return { refreshing, refresh, refreshControl: control };
}
