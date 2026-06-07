import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeBack } from "../../hooks/useSafeBack";
import { ArrowUpDown, Train, TramFront } from "lucide-react-native";
import { BackButton, Page, Txt } from "../../components/design";
import { ScreenTitle } from "../../components/tripview/ScreenTitle";
import { MIN_TOUCH, SEMANTIC, SPACING, resolveTextStyle } from "../../constants/design";
import { keyboardAvoidingBehavior } from "../../utils/keyboard";
import { formatRouteCodes, tripAccentColor } from "../../utils/tripDisplay";
import { getRouteHexColor } from "../../utils/transitColors";
import { type JourneyRoute } from "../../constants/sampleData";
import { SYDNEY_STATIONS } from "../../constants/stations";
import { useColors } from "../../hooks/useColors";
import { useAppConfig } from "../../hooks/useAppConfig";
import { useTripPlan } from "../../hooks/useTripPlan";
import { useStore } from "../../store/store";
import { tripsToDisplay } from "../../utils/displayAdapters";
import { resolveStationByName, resolveStationName } from "../../utils/resolveStation";

function RouteCard({ route }: { route: JourneyRoute }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const routesSummary = formatRouteCodes(route.chips);
  const accent = tripAccentColor(route.chips);

  return (
    <View
      style={{
        marginHorizontal: SPACING.screen,
        marginBottom: SPACING.section,
        backgroundColor: c.card,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${route.durationMin} minute route. Depart ${route.depart}, arrive ${route.arrive}. Tap for steps.`}
        style={{ padding: SPACING.screen, minHeight: MIN_TOUCH + 8 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Txt size={20} weight="700" color={c.text}>
              {route.durationMin} min
              {route.fastest ? (
                <Txt size={13} weight="600" color={c.primary}>
                  {"  · Fastest"}
                </Txt>
              ) : null}
            </Txt>
            <Txt size={14} color={c.textSecondary} style={{ marginTop: 4 }}>
              {route.depart} → {route.arrive} · {route.changes}
            </Txt>
            <Txt size={13} color={c.textSecondary} style={{ marginTop: 2 }} numberOfLines={1}>
              {routesSummary}
            </Txt>
          </View>
          <Txt size={16} weight="700" color={accent}>
            {route.fare}
          </Txt>
        </View>
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: SPACING.screen, paddingVertical: 12 }}>
          {route.steps.map((step, i) => {
            const last = i === route.steps.length - 1;
            const dotColor = getRouteHexColor(step.mode, step.route);
            return (
              <View key={i} style={{ paddingBottom: last ? 0 : 12 }}>
                {i > 0 ? (
                  <View
                    style={{
                      marginBottom: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: c.muted,
                      alignItems: "center",
                    }}
                  >
                    <Txt size={11} weight="700" color={c.textSecondary}>
                      CHANGE
                    </Txt>
                    {step.route ? (
                      <Txt size={13} weight="600" color={dotColor} style={{ marginTop: 2 }}>
                        Board {step.route}
                      </Txt>
                    ) : null}
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      marginTop: 6,
                      backgroundColor: dotColor,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt size={15} weight="600" color={c.text}>
                      {step.label}
                    </Txt>
                    <Txt size={13} color={c.textSecondary} style={{ marginTop: 2 }}>
                      {step.detail}
                    </Txt>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

interface FieldProps {
  value: string;
  onChange: (t: string) => void;
  onFocus: () => void;
  placeholder: string;
  marker: React.ReactNode;
  rounded: "top" | "bottom";
}

function StationField({ value, onChange, onFocus, placeholder, marker, rounded }: FieldProps) {
  const c = useColors();
  const radius =
    rounded === "top"
      ? { borderTopLeftRadius: 10, borderTopRightRadius: 10 }
      : { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 };
  return (
    <View
      style={{
        borderWidth: 1,
        borderTopWidth: rounded === "bottom" ? 0 : 1,
        borderColor: c.border,
        ...radius,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: SPACING.screen,
        minHeight: MIN_TOUCH + 4,
        backgroundColor: c.card,
      }}
    >
      {marker}
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        accessibilityLabel={placeholder}
        style={{ flex: 1, fontSize: 16, color: c.text, ...resolveTextStyle("500") }}
      />
    </View>
  );
}

export default function JourneyScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ originId?: string; destinationId?: string }>();
  const addSavedTrip = useStore((s) => s.addSavedTrip);
  const removeSavedTrip = useStore((s) => s.removeSavedTrip);
  const savedTrips = useStore((s) => s.savedTrips);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [active, setActive] = useState<"from" | "to" | null>(null);
  const [query, setQuery] = useState<{ from: string; to: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const o = params.originId
      ? SYDNEY_STATIONS.find((s) => s.id === String(params.originId))
      : null;
    const d = params.destinationId
      ? SYDNEY_STATIONS.find((s) => s.id === String(params.destinationId))
      : null;
    if (o) setFrom(o.name);
    if (d) setTo(d.name);
    if (o && d) setQuery({ from: o.name, to: d.name });
  }, [params.originId, params.destinationId]);

  const canSearch = from.trim().length > 0 && to.trim().length > 0;

  const { data: appConfig } = useAppConfig();
  const { data, isLoading, isError } = useTripPlan(query?.from ?? null, query?.to ?? null);
  const routes = useMemo(() => {
    if (!query) return [];
    if (data && data.length > 0) {
      return tripsToDisplay(data, { showWalkLegs: appConfig?.showWalkLegsInTrips });
    }
    return [];
  }, [data, query, appConfig?.showWalkLegsInTrips]);

  const isCurrentTripSaved = useMemo(() => {
    if (!query) return false;
    const orig = resolveStationByName(query.from);
    const dest = resolveStationByName(query.to);
    if (!orig || !dest) return false;
    return savedTrips.some((t) => t.origin_id === orig.id && t.destination_id === dest.id);
  }, [query, savedTrips]);

  const activeText = active === "from" ? from : active === "to" ? to : "";
  const suggestions = useMemo(() => {
    const q = activeText.trim().toLowerCase();
    if (!active || q.length < 2) return [];
    const exact = SYDNEY_STATIONS.some((s) => s.name.toLowerCase() === q);
    if (exact) return [];
    return SYDNEY_STATIONS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6);
  }, [active, activeText]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const onSearch = () => {
    setActive(null);
    const resolvedFrom = resolveStationName(from);
    const resolvedTo = resolveStationName(to);
    if (!resolvedFrom || !resolvedTo) return;
    setFrom(resolvedFrom);
    setTo(resolvedTo);
    setQuery({ from: resolvedFrom, to: resolvedTo });
  };

  const onSaveTrip = () => {
    if (!query || routes.length === 0) return;
    const orig = resolveStationByName(query.from);
    const dest = resolveStationByName(query.to);
    if (!orig || !dest) return;
    const existing = savedTrips.find(
      (t) => t.origin_id === orig.id && t.destination_id === dest.id
    );
    if (existing) {
      removeSavedTrip(existing.id);
      Alert.alert("Trip removed", "Removed from your Trips tab.");
      return;
    }
    const active = routes[0];
    const chip = active?.chips[0];
    const mode = chip?.mode === "light_rail" ? "light_rail" : "train";
    addSavedTrip({
      id: `trip_${orig.id}_${dest.id}_${Date.now()}`,
      origin_id: orig.id,
      origin_name: orig.name,
      destination_id: dest.id,
      destination_name: dest.name,
      transit_mode: mode,
      route_number: chip?.route ?? (mode === "light_rail" ? "L2" : "T1"),
    });
    setSavedFlash(true);
    Alert.alert("Trip saved", "This trip appears on your Trips tab.");
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const goBack = useSafeBack("/(tabs)/tools");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Plan Trip" left={<BackButton variant="plain" onPress={goBack} />} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={keyboardAvoidingBehavior()}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
      <Page tabScreen>
        <View
          style={{
            backgroundColor: c.card,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
            paddingHorizontal: SPACING.screen,
            paddingTop: SPACING.section,
            paddingBottom: SPACING.section,
            zIndex: 2,
          }}
        >
          <StationField
            value={from}
            onChange={setFrom}
            onFocus={() => setActive("from")}
            placeholder="From station"
            rounded="top"
            marker={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.primary }} />}
          />

          <View style={{ position: "relative", height: 1, backgroundColor: c.border, zIndex: 1 }}>
            <Pressable
              onPress={swap}
              accessibilityRole="button"
              accessibilityLabel="Swap from and to stations"
              style={{
                position: "absolute",
                right: 12,
                top: -22,
                width: MIN_TOUCH,
                height: MIN_TOUCH,
                borderRadius: MIN_TOUCH / 2,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUpDown size={18} color={c.text} strokeWidth={2} />
            </Pressable>
          </View>

          <StationField
            value={to}
            onChange={setTo}
            onFocus={() => setActive("to")}
            placeholder="To station"
            rounded="bottom"
            marker={<View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#FF3B30" }} />}
          />

          {suggestions.length > 0 ? (
            <View
              style={{
                marginTop: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
                overflow: "hidden",
                maxHeight: 280,
              }}
            >
              {suggestions.map((s, idx) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    if (active === "from") setFrom(s.name);
                    else if (active === "to") setTo(s.name);
                    setActive(null);
                  }}
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: SPACING.screen,
                    minHeight: MIN_TOUCH,
                    borderTopWidth: idx > 0 ? 1 : 0,
                    borderTopColor: c.separator,
                  }}
                >
                  {s.mode === "lightrail" ? (
                    <TramFront size={16} color={c.textSecondary} strokeWidth={2} />
                  ) : (
                    <Train size={16} color={s.mode === "metro" ? "#0095A0" : c.textSecondary} strokeWidth={2} />
                  )}
                  <Txt size={15} color={c.text} style={{ flex: 1 }} numberOfLines={1}>
                    {s.name}
                  </Txt>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable
            disabled={!canSearch}
            onPress={onSearch}
            accessibilityRole="button"
            accessibilityLabel="Search routes"
            style={{
              backgroundColor: c.primary,
              borderRadius: 10,
              minHeight: MIN_TOUCH + 4,
              alignItems: "center",
              justifyContent: "center",
              marginTop: SPACING.section,
              opacity: canSearch ? 1 : 0.4,
            }}
          >
            <Txt size={16} weight="700" color="#FFFFFF">
              Search routes
            </Txt>
          </Pressable>
        </View>

        {query ? (
          isLoading && routes.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 48 }}>
              <Txt size={15} color={c.textSecondary}>
                Finding routes…
              </Txt>
            </View>
          ) : routes.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 32 }}>
              <Txt size={16} weight="600" color={c.text}>
                No routes found
              </Txt>
              <Txt size={14} color={c.textSecondary} style={{ marginTop: 8, textAlign: "center" }}>
                {isError
                  ? "Could not reach the trip planner. Check that the backend is running."
                  : "Try station names like Central Station and Parramatta."}
              </Txt>
            </View>
          ) : (
            <View style={{ paddingTop: SPACING.section }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: SPACING.screen,
                  paddingBottom: SPACING.section,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Txt size={16} weight="700" color={c.text}>
                    {query.from} → {query.to}
                  </Txt>
                  <Txt size={14} color={c.textSecondary} style={{ marginTop: 2 }}>
                    {routes.length} route{routes.length !== 1 ? "s" : ""}
                  </Txt>
                </View>
                <Pressable
                  onPress={onSaveTrip}
                  accessibilityRole="button"
                  accessibilityLabel={isCurrentTripSaved ? "Remove saved trip" : "Save trip"}
                  style={{
                    backgroundColor: savedFlash
                      ? SEMANTIC.success
                      : isCurrentTripSaved
                        ? SEMANTIC.destructive
                        : c.primary,
                    paddingHorizontal: SPACING.cell,
                    minHeight: MIN_TOUCH - 4,
                    borderRadius: 8,
                    justifyContent: "center",
                  }}
                >
                  <Txt size={14} weight="700" color="#FFFFFF">
                    {savedFlash ? "Saved" : isCurrentTripSaved ? "Remove trip" : "Save trip"}
                  </Txt>
                </Pressable>
              </View>
              {routes.map((r) => (
                <RouteCard key={r.id} route={r} />
              ))}
            </View>
          )
        ) : (
          <View style={{ paddingTop: 48, paddingHorizontal: SPACING.screen }}>
            <Txt size={15} color={c.textSecondary} style={{ textAlign: "center", lineHeight: 22 }}>
              Enter a start and destination station, then tap Search routes.
            </Txt>
          </View>
        )}
      </Page>
      </KeyboardAvoidingView>
    </View>
  );
}
