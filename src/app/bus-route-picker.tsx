import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, GroupedList, ListRow, SectionHeader, Txt } from "../components/design";
import { ScreenTitle } from "../components/tripview/ScreenTitle";
import { LineBadge } from "../components/design/LineBadge";
import { SPACING } from "../constants/design";
import { getStackContentClearance } from "../constants/layout";
import { getBusStopsForRoute, getSydneyBusLines, type BusLine } from "../constants/busNetworks";
import { useColors } from "../hooks/useColors";
import { useSafeBack } from "../hooks/useSafeBack";

export default function BusRoutePickerScreen() {
  const c = useColors();
  const router = useRouter();
  const goBack = useSafeBack("/new-trip");
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<BusLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getSydneyBusLines()
      .then((list) => {
        if (!cancelled) setLines(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (l) =>
        l.route.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.dests.some((d) => d.toLowerCase().includes(q))
    );
  }, [lines, search]);

  const openRoute = (route: string) => {
    router.push({
      pathname: "/station-picker",
      params: { role: "from", mode: "bus", flow: "route", route },
    } as never);
  };

  const openRouteTimetable = async (route: string) => {
    const stops = await getBusStopsForRoute(route);
    const stationId = stops[0];
    if (!stationId) return;
    router.push({
      pathname: "/departures",
      params: { stationId, route },
    } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenTitle title="Bus route" left={<BackButton variant="plain" onPress={goBack} />} />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: getStackContentClearance(insets.bottom) }}
      >
        <Txt
          size={14}
          color={c.textSecondary}
          style={{ paddingHorizontal: SPACING.screen, paddingTop: 12, lineHeight: 20 }}
        >
          Choose a route, then pick your stop. Full timetables use live route times from transportnsw.info.
        </Txt>
        <View style={{ paddingHorizontal: SPACING.screen, paddingTop: 12, paddingBottom: 8 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search routes"
            placeholderTextColor={c.textSecondary}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={{
              backgroundColor: c.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 16,
              color: c.text,
            }}
          />
        </View>

        <SectionHeader title={loading ? "Loading routes…" : `${filtered.length} routes`} />
        <GroupedList>
          {filtered.slice(0, 200).map((line) => (
            <ListRow
              key={line.route}
              label={line.route}
              subtitle={line.name}
              icon={<LineBadge route={line.route} color={line.color} />}
              onPress={() => openRoute(line.route)}
              minHeight={60}
              trailing={
                <Pressable
                  onPress={() => void openRouteTimetable(line.route)}
                  hitSlop={8}
                  style={{ paddingHorizontal: 8, paddingVertical: 4, marginRight: 4 }}
                >
                  <Txt size={13} weight="600" color={c.primary}>
                    Timetable
                  </Txt>
                </Pressable>
              }
            />
          ))}
        </GroupedList>
      </ScrollView>
    </View>
  );
}
