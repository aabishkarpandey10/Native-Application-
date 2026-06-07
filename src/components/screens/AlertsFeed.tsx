import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { BackButton, Chip, EmptyState, Txt } from "../design";
import { ScreenTitle } from "../tripview/ScreenTitle";
import { HAIRLINE, SPACING } from "../../constants/design";
import { getStackContentClearance, getTabBarContentClearance } from "../../constants/layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SampleAlert, Severity } from "../../constants/sampleData";
import { formatSydneyTime } from "../../utils/tfnswTime";
import { useColors } from "../../hooks/useColors";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { useServiceAlerts } from "../../hooks/useServiceAlerts";
import { ApiRequestError } from "../../services/apiClient";
import { alertsToDisplay } from "../../utils/displayAdapters";
import { isCriticalAlert, isTrackworkAlert } from "../../utils/serviceAlert";
import { LineBadge } from "../design/LineBadge";

const SEV: Record<Severity, { color: string; label: string }> = {
  critical: { color: "#FF3B30", label: "Critical" },
  warning: { color: "#FF9500", label: "Warning" },
  info: { color: "#007AFF", label: "Info" },
  success: { color: "#34C759", label: "Resolved" },
};

const FILTERS = ["All", "Trackwork", "Critical only"];
const MAX_LIST_ITEMS = 80;

function AlertCard({ alert }: { alert: SampleAlert }) {
  const c = useColors();
  const sev = SEV[alert.severity];
  return (
    <View
      style={{
        backgroundColor: c.card,
        paddingHorizontal: SPACING.screen,
        paddingVertical: 16,
        borderBottomWidth: HAIRLINE,
        borderBottomColor: c.separator,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Txt size={16} weight="600" color={c.text} style={{ flex: 1 }}>
          {alert.title}
        </Txt>
        <Txt size={12} color={c.textSecondary}>
          {alert.time}
        </Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <LineBadge route={alert.route} small />
        <Txt size={13} weight="600" color={sev.color}>
          {sev.label}
        </Txt>
      </View>
      <Txt size={14} color={c.textSecondary} lineHeight={20} style={{ marginTop: 8 }} numberOfLines={4}>
        {alert.description}
      </Txt>
    </View>
  );
}

interface AlertsFeedProps {
  showBack?: boolean;
  onBack?: () => void;
  /** Tab screens need extra clearance for the floating tab bar. */
  tabScreen?: boolean;
}

export function AlertsFeed({ showBack, onBack, tabScreen = false }: AlertsFeedProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const listBottomPad = tabScreen
    ? getTabBarContentClearance(insets.bottom)
    : getStackContentClearance(insets.bottom);
  const focused = useIsFocused();
  const [filter, setFilter] = useState(FILTERS[0]);
  const { alerts, meta, isLoading, isError, error, isRefetching, refetchFromTfnsw } = useServiceAlerts({
    enabled: focused,
  });

  const { refreshControl } = useRefreshControl(async () => {
    await refetchFromTfnsw();
  });

  const filteredSource = useMemo(() => {
    const source = alerts ?? [];
    if (filter === "Critical only") return source.filter(isCriticalAlert);
    if (filter === "Trackwork") return source.filter(isTrackworkAlert);
    return source;
  }, [alerts, filter]);

  const visible = useMemo(
    () => alertsToDisplay(filteredSource.slice(0, MAX_LIST_ITEMS)),
    [filteredSource]
  );

  const criticalCount =
    meta?.criticalCount ?? (alerts ?? []).filter(isCriticalAlert).length;
  const trackworkCount =
    meta?.trackworkCount ?? (alerts ?? []).filter(isTrackworkAlert).length;
  const liveSource = meta?.tfnswLive !== false;
  const updatedLabel = meta?.asOf
    ? `Updated ${formatSydneyTime(meta.asOf, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}`
    : isRefetching
      ? "Updating from Transport NSW…"
      : liveSource
        ? "Live from transportnsw.info"
        : "Could not reach Transport NSW — pull to refresh";

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: SPACING.screen, paddingBottom: 8 }}>
        <Txt size={14} color={c.textSecondary}>
          {criticalCount > 0
            ? `${criticalCount} critical · ${trackworkCount} trackwork · ${updatedLabel}`
            : trackworkCount > 0
              ? `${trackworkCount} trackwork alert${trackworkCount !== 1 ? "s" : ""} · ${updatedLabel}`
              : isLoading
                ? "Loading from Transport NSW…"
                : updatedLabel}
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 10 }}
        >
          {FILTERS.map((f) => (
            <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
        {(alerts?.length ?? 0) > MAX_LIST_ITEMS ? (
          <Txt size={12} color={c.textSecondary} style={{ marginTop: 6 }}>
            Showing first {MAX_LIST_ITEMS} of {alerts?.length ?? 0} alerts. Use filters to narrow results.
          </Txt>
        ) : null}
      </View>
    ),
    [alerts?.length, c.textSecondary, criticalCount, filter, isLoading, trackworkCount, updatedLabel]
  );

  const renderItem = useCallback(
    ({ item }: { item: SampleAlert }) => <AlertCard alert={item} />,
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title="Service Information"
        left={
          showBack && onBack ? (
            <BackButton variant="plain" onPress={onBack} />
          ) : undefined
        }
      />

      {isLoading && visible.length === 0 ? (
        <EmptyState title="Loading alerts" message="Fetching service updates from Transport NSW…" />
      ) : isError && visible.length === 0 ? (
        <EmptyState
          title="Alerts unavailable"
          message={
            error instanceof ApiRequestError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Pull down to refresh or check your connection."
          }
        />
      ) : visible.length === 0 ? (
        <>
          {listHeader}
          <EmptyState
            title={
              filter === "Trackwork"
                ? "No trackwork listed"
                : filter === "Critical only"
                  ? "No critical disruptions"
                  : "All clear"
            }
            message={
              filter === "Trackwork"
                ? "No planned or ongoing trackwork from Transport NSW right now. Pull down to refresh."
                : filter === "Critical only"
                  ? "No major service disruptions right now. Trackwork and minor delays are in other filters."
                  : "No active service alerts. Resolved issues are removed automatically."
            }
          />
        </>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          refreshControl={refreshControl}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={{
            paddingBottom: listBottomPad,
            backgroundColor: c.card,
            borderTopWidth: 0.5,
            borderBottomWidth: 0.5,
            borderColor: c.separator,
          }}
          style={{ flex: 1, backgroundColor: c.bg }}
        />
      )}
    </View>
  );
}
