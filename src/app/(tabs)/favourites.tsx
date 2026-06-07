import { memo, useCallback, type ReactNode } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Alert, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Trash2 } from "lucide-react-native";
import {
  DepartureTime,
  GroupedList,
  LineBadge,
  Page,
  SectionHeader,
  Txt,
} from "../../components/design";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { cardShadow, LIST_ICON_SEPARATOR, MIN_TOUCH, RADIUS, SPACING } from "../../constants/design";
import { FeatureGate } from "../../components/FeatureGate";
import { useAppFeatures } from "../../hooks/useAppFeatures";
import { useColors } from "../../hooks/useColors";
import { useRefreshControl } from "../../hooks/useRefreshControl";
import { useStore } from "../../store/store";
import { useDepartures } from "../../hooks/useDepartures";
import { compactRouteCode } from "../../utils/transitColors";
import { minutesUntil, formatSydneyTime } from "../../utils/tfnswTime";

const ROW_MIN_HEIGHT = 68;
const DELETE_SIZE = 40;

function shortStationName(name: string): string {
  return name.replace(/\s+Station$/i, "").replace(/\s+Wharf$/i, "").trim();
}

function TripsListRow({
  route,
  title,
  subtitle,
  onPress,
  onRemove,
  trailing,
  accessibilityLabel,
}: {
  route: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  onRemove: () => void;
  trailing?: ReactNode;
  accessibilityLabel: string;
}) {
  const c = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: ROW_MIN_HEIGHT,
        backgroundColor: c.card,
        paddingLeft: SPACING.cell,
        paddingRight: SPACING.cell,
        paddingVertical: 12,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minWidth: 0,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <LineBadge route={route} />
        <View style={{ flex: 1, marginLeft: SPACING.iconGap, minWidth: 0, marginRight: SPACING.iconGap }}>
          <Txt size={17} weight="600" color={c.text} numberOfLines={1}>
            {title}
          </Txt>
          <Txt size={14} color={c.textSecondary} numberOfLines={1} style={{ marginTop: 3 }}>
            {subtitle}
          </Txt>
        </View>
        {trailing ? <View style={{ flexShrink: 0, marginRight: 4 }}>{trailing}</View> : null}
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Remove"
        style={({ pressed }) => ({
          width: DELETE_SIZE,
          height: DELETE_SIZE,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: RADIUS.sm,
          backgroundColor: pressed ? c.separator : c.muted,
          borderWidth: 1,
          borderColor: c.border,
        })}
      >
        <Trash2 size={18} color={c.textSecondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function SavedTripRow({
  originName,
  destName,
  route,
  onPress,
  onRemove,
}: {
  originName: string;
  destName: string;
  route: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const code = compactRouteCode(route);
  return (
    <TripsListRow
      route={code}
      title={shortStationName(originName)}
      subtitle={`→ ${shortStationName(destName)}`}
      onPress={onPress}
      onRemove={onRemove}
      accessibilityLabel={`Trip ${originName} to ${destName}`}
    />
  );
}

const SavedStopRow = memo(function SavedStopRow({
  stationId,
  name,
  onRemove,
  fetchEnabled,
}: {
  stationId: string;
  name: string;
  onRemove: () => void;
  fetchEnabled: boolean;
}) {
  const { data, isLoading, isError } = useDepartures(stationId, 1, {
    preview: true,
    enabled: fetchEnabled,
  });
  const next = data?.departures?.[0];
  const minutes = next ? minutesUntil(next.departureTime) : null;
  const route = compactRouteCode(
    next?.routeNumber ?? (stationId.endsWith("_M") ? "M1" : stationId.endsWith("_LR") ? "L1" : "T1")
  );
  const dest = next?.destination ? shortStationName(next.destination) : "";

  let subtitle = "Tap for departures";
  if (isLoading) subtitle = "Loading…";
  else if (isError) subtitle = "Tap for timetable";
  else if (dest) subtitle = `to ${dest}`;
  else if (!isLoading) subtitle = "No upcoming services";

  const trailing =
    minutes !== null && next ? (
      <DepartureTime
        departsAt={next.departureTime.toISOString()}
        clock={formatSydneyTime(next.departureTime)}
        minutes={minutes}
      />
    ) : null;

  const router = useRouter();

  return (
    <TripsListRow
      route={route}
      title={shortStationName(name)}
      subtitle={subtitle}
      trailing={trailing}
      onPress={() => router.push(`/departures?stationId=${stationId}` as never)}
      onRemove={() =>
        Alert.alert("Remove stop", `Remove ${name}?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: onRemove },
        ])
      }
      accessibilityLabel={name}
    />
  );
});

export default function FavouritesScreen() {
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { favourites: favouritesEnabled, tripPlanner } = useAppFeatures();
  const { favorites, savedTrips, removeFavorite, removeSavedTrip } = useStore();
  const screenFocused = useIsFocused();

  const onRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["departures"] });
  }, [queryClient]);

  const { refreshControl } = useRefreshControl(onRefresh);

  const visibleSavedTrips = tripPlanner ? savedTrips : [];
  const empty = visibleSavedTrips.length === 0 && favorites.length === 0;
  return (
    <FeatureGate
      enabled={favouritesEnabled}
      inline
      title="Trips unavailable"
      message="Saved trips and favourites are turned off in admin settings."
      fallbackHref="/(tabs)/tools"
    >
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle
        title="Trips"
        right={
          tripPlanner ? (
          <Pressable
            onPress={() => router.push("/new-trip" as never)}
            accessibilityRole="button"
            accessibilityLabel="New trip"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: MIN_TOUCH - 2,
              paddingHorizontal: 12,
              borderRadius: RADIUS.button,
              backgroundColor: pressed ? c.separator : c.muted,
            })}
          >
            <Plus size={22} color={c.primary} strokeWidth={2.6} />
            <Txt size={16} weight="600" color={c.primary}>
              New
            </Txt>
          </Pressable>
          ) : null
        }
      />

      <Page tabScreen refreshControl={refreshControl}>
        {empty ? (
          <View style={{ paddingHorizontal: SPACING.screen, paddingTop: 24 }}>
            <View
              style={[
                {
                  borderRadius: RADIUS.card,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.card,
                  paddingHorizontal: 24,
                  paddingVertical: 36,
                  alignItems: "center",
                },
                cardShadow(c.isDark),
              ]}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Star size={28} color={c.textSecondary} strokeWidth={1.8} />
              </View>
              <Txt size={22} weight="700" color={c.text}>
                No trips yet
              </Txt>
              <Txt
                size={15}
                color={c.textSecondary}
                style={{ textAlign: "center", marginTop: 8, lineHeight: 22, maxWidth: 280 }}
              >
                Plan a journey once, then keep it here for quick access.
              </Txt>
              {tripPlanner ? (
                <Pressable
                  onPress={() => router.push("/new-trip" as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Create new trip"
                  style={({ pressed }) => ({
                    marginTop: 22,
                    backgroundColor: pressed ? c.header : c.primary,
                    paddingHorizontal: 28,
                    minHeight: MIN_TOUCH,
                    borderRadius: RADIUS.button,
                    justifyContent: "center",
                  })}
                >
                  <Txt size={16} weight="700" color="#FFFFFF">
                    New trip
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {visibleSavedTrips.length > 0 ? (
              <>
                <SectionHeader title="My trips" />
                <GroupedList separatorInset={LIST_ICON_SEPARATOR}>
                  {visibleSavedTrips.map((j) => (
                    <SavedTripRow
                      key={j.id}
                      originName={j.origin_name}
                      destName={j.destination_name}
                      route={j.route_number ?? "T1"}
                      onPress={() =>
                        router.push({
                          pathname: "/trip-results",
                          params: {
                            fromId: j.origin_id,
                            fromName: j.origin_name,
                            toId: j.destination_id,
                            toName: j.destination_name,
                          },
                        } as never)
                      }
                      onRemove={() =>
                        Alert.alert("Remove trip", "Remove this saved trip?", [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Remove",
                            style: "destructive",
                            onPress: () => removeSavedTrip(j.id),
                          },
                        ])
                      }
                    />
                  ))}
                </GroupedList>
              </>
            ) : null}

            {favorites.length > 0 ? (
              <>
                <SectionHeader title="Saved stops" />
                <GroupedList separatorInset={LIST_ICON_SEPARATOR}>
                  {favorites.map((s) => (
                    <SavedStopRow
                      key={s.station_id}
                      stationId={s.station_id}
                      name={s.station_name}
                      fetchEnabled={screenFocused}
                      onRemove={() => removeFavorite(s.station_id)}
                    />
                  ))}
                </GroupedList>
              </>
            ) : null}
          </>
        )}
      </Page>
    </View>
    </FeatureGate>
  );
}
