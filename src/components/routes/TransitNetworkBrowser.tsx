import { useRouter, type Href } from "expo-router";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ModeBadge from "../ModeBadge";
import { SegmentControl } from "../ui/SegmentControl";
import {
  TRANSIT_NETWORK_SECTIONS,
  getBusNetworkSection,
  getStationById,
  resolveStationNames,
  type ModeNetworkSection,
  type TransitModeKey,
} from "../../constants/transitNetworks";

const MODE_TABS: { key: TransitModeKey | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "train", label: "Train" },
  { key: "metro", label: "Metro" },
  { key: "lightrail", label: "Light rail" },
  { key: "ferry", label: "Ferry" },
  { key: "bus", label: "Bus" },
];

function BranchCard({
  branch,
  defaultExpanded,
}: {
  branch: { id: string; route: string; name: string; color: string; stationIds: string[] };
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const stops = useMemo(() => resolveStationNames(branch.stationIds), [branch.stationIds]);

  return (
    <View className="mb-2.5 rounded-2xl bg-surface-card border border-surface-border overflow-hidden">
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        className="flex-row items-center px-4 py-3.5 gap-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <View
          className="min-w-[44px] px-2 py-1 rounded-lg items-center"
          style={{ backgroundColor: branch.color }}
        >
          <Text className="text-white text-xs font-black">{branch.route}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm" numberOfLines={2}>
            {branch.name}
          </Text>
          <Text className="text-zinc-500 text-xs mt-0.5">
            {stops.length} stops · sequenced
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#71717A" />
        ) : (
          <ChevronDown size={18} color="#71717A" />
        )}
      </Pressable>

      {expanded ? (
        <View className="px-4 pb-4 pt-1 border-t border-surface-border">
          {stops.map((stop, index) => {
            const station = getStationById(stop.id);
            const canOpen = !!station;
            const isFirst = index === 0;
            const isLast = index === stops.length - 1;

            return (
              <Pressable
                key={`${branch.id}-${stop.id}-${index}`}
                disabled={!canOpen}
                onPress={() => {
                  if (station) {
                    router.push(`/station/${station.id}` as Href);
                  }
                }}
                className="flex-row items-start min-h-[44px]"
                style={({ pressed }) => ({ opacity: pressed && canOpen ? 0.85 : 1 })}
              >
                <View className="w-8 items-center mr-3">
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center border-2"
                    style={{
                      borderColor: branch.color,
                      backgroundColor: isFirst || isLast ? `${branch.color}33` : "transparent",
                    }}
                  >
                    <Text className="text-[10px] font-bold text-zinc-300">{index + 1}</Text>
                  </View>
                  {!isLast ? (
                    <View
                      className="w-0.5 flex-1 min-h-[12px] my-0.5"
                      style={{ backgroundColor: `${branch.color}55` }}
                    />
                  ) : null}
                </View>
                <View className="flex-1 py-2 border-b border-surface-border/50 last:border-b-0">
                  <Text className="text-zinc-100 text-sm font-medium">{stop.name}</Text>
                  {station?.code ? (
                    <Text className="text-zinc-600 text-[10px] mt-0.5">Code {station.code}</Text>
                  ) : null}
                </View>
                {canOpen ? <MapPin size={14} color="#52525B" style={{ marginTop: 10 }} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function TransitNetworkBrowser() {
  const [modeFilter, setModeFilter] = useState<TransitModeKey | "all">("all");
  const [busSection, setBusSection] = useState<ModeNetworkSection | null>(null);
  const [busLoading, setBusLoading] = useState(false);

  useEffect(() => {
    if (modeFilter !== "bus" && modeFilter !== "all") return;
    if (busSection || busLoading) return;
    setBusLoading(true);
    void getBusNetworkSection()
      .then(setBusSection)
      .finally(() => setBusLoading(false));
  }, [modeFilter, busSection, busLoading]);

  const sections = useMemo(() => {
    const base =
      modeFilter === "all"
        ? [...TRANSIT_NETWORK_SECTIONS]
        : TRANSIT_NETWORK_SECTIONS.filter((s) => s.mode === modeFilter);
    if ((modeFilter === "all" || modeFilter === "bus") && busSection) {
      if (modeFilter === "bus") return [busSection];
      return [...base, busSection];
    }
    return base;
  }, [modeFilter, busSection]);

  return (
    <View>
      <Text className="text-zinc-400 text-sm mb-3">
        Lines and stops in travel order. Tap a line to expand; tap a stop to open live departures.
      </Text>

      <View className="mb-4">
        <SegmentControl
          options={MODE_TABS.map((t) => ({ key: t.key, label: t.label }))}
          value={modeFilter}
          onChange={setModeFilter}
        />
      </View>

      {busLoading && (modeFilter === "bus" || modeFilter === "all") ? (
        <Text className="text-zinc-500 text-sm mb-4">Loading bus routes…</Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.mode} className="mb-6">
          <View className="flex-row items-center gap-2.5 mb-3">
            <ModeBadge mode={section.mode} size="md" />
            <Text className="text-white font-bold text-lg">{section.label}</Text>
            <Text className="text-zinc-500 text-sm">
              {section.branches.length} line{section.branches.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {section.branches.map((branch, i) => (
            <BranchCard
              key={`${section.mode}-${branch.id}-${i}`}
              branch={branch}
              defaultExpanded={modeFilter !== "all" && i === 0}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
