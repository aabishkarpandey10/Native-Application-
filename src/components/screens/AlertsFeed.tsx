import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { Chip, EmptyState, Txt } from "../design";
import { ScreenTitle } from "../tripview/ScreenTitle";
import { MIN_TOUCH, SPACING, TAB_BAR_HEIGHT } from "../../constants/design";
import type { SampleAlert, Severity } from "../../constants/sampleData";
import { formatSydneyTime } from "../../utils/tfnswTime";
import { useColors } from "../../hooks/useColors";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { useServiceAlerts } from "../../hooks/useServiceAlerts";
import { alertsToDisplay } from "../../utils/displayAdapters";
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
        paddingVertical: 14,
        borderBottomWidth: 0.5,
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
}

export function AlertsFeed({ showBack, onBack }: AlertsFeedProps) {
  const c = useColors();
  const focused = useIsFocused();
  const [filter, setFilter] = useState(FILTERS[0]);
  const { alerts, meta, isLoading, isError, isRefetching, refetchFromTfnsw } = useServiceAlerts({
    enabled: focused,
  });

  const { refreshControl } = useRefreshControl(async () => {
    await refetchFromTfnsw();
  });

  const all = useMemo(() => {
    if (alerts?.length) return alertsToDisplay(alerts);
    return [];
  }, [alerts]);

  const visible = useMemo(() => {
    let list = all;
    if (filter === "Critical only") list = all.filter((a) => a.severity === "critical");
    else if (filter === "Trackwork") {
      list = all.filter(
        (a) =>
          /trackwork/i.test(a.title) ||
          /trackwork|buses replace|planned maintenance|changed timetable/i.test(a.description)
      );
    }
    return list.slice(0, MAX_LIST_ITEMS);
  }, [filter, all]);

  const criticalCount = all.filter((a) => a.severity === "critical").length;
  const trackworkCount = all.filter((a) => /trackwork/i.test(a.title)).length;
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
        {all.length > MAX_LIST_ITEMS ? (
          <Txt size={12} color={c.textSecondary} style={{ marginTop: 6 }}>
            Showing first {MAX_LIST_ITEMS} of {all.length} alerts. Use filters to narrow results.
          </Txt>
        ) : null}
      </View>
    ),
    [all.length, c.textSecondary, criticalCount, filter, isLoading, trackworkCount, updatedLabel, liveSource]
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
            <Pressable onPress={onBack} style={{ width: MIN_TOUCH, height: MIN_TOUCH, justifyContent: "center" }}>
              <ChevronLeft size={26} color={c.text} strokeWidth={2.2} />
            </Pressable>
          ) : undefined
        }
      />

      {isLoading && visible.length === 0 ? (
        <EmptyState title="Loading alerts" message="Fetching service updates from Transport NSW…" />
      ) : isError && visible.length === 0 ? (
        <EmptyState title="Alerts unavailable" message="Pull down to refresh or check your connection." />
      ) : visible.length === 0 ? (
        <>
          {listHeader}
          <EmptyState
            title={filter === "Trackwork" ? "No trackwork listed" : "All clear"}
            message={
              filter === "Trackwork"
                ? "No planned or ongoing trackwork from Transport NSW right now. Pull down to refresh."
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
            paddingBottom: TAB_BAR_HEIGHT + 24,
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
