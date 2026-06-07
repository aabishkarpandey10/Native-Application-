import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "../hooks/useSafeBack";
import { ModalHeader } from "../components/tripview/ModalHeader";
import {
  TransportMenuRow,
  TransportMenuRowPin,
  type TransportKind,
} from "../components/tripview/TransportMenuRow";
import { GroupedList, SectionHeader, Txt } from "../components/design";
import { LIST_TRANSPORT_SEPARATOR, SPACING } from "../constants/design";
import { getStackContentClearance } from "../constants/layout";
import { FeatureGate } from "../components/FeatureGate";
import { useAppFeatures } from "../hooks/useAppFeatures";
import { useColors } from "../hooks/useColors";

type PickerMode = "train" | "metro" | "bus" | "ferry" | "lightrail";

interface TripSection {
  title: string;
  rows: {
    label: string;
    kind?: TransportKind;
    pin?: boolean;
    mode: PickerMode;
    flow?: string;
  }[];
}

const SECTIONS: TripSection[] = [
  {
    title: "Sydney Trains",
    rows: [{ label: "By Station", kind: "train", mode: "train" }],
  },
  {
    title: "Sydney Metro",
    rows: [{ label: "By Station", kind: "metro", mode: "metro" }],
  },
  {
    title: "Sydney & Regional Buses",
    rows: [
      { label: "By Route", kind: "bus", mode: "bus", flow: "route" },
      { label: "By Stop", pin: true, mode: "bus", flow: "stop" },
    ],
  },
  {
    title: "Sydney Ferries",
    rows: [{ label: "By Wharf", kind: "ferry", mode: "ferry" }],
  },
  {
    title: "Sydney & Newcastle Light Rail",
    rows: [{ label: "By Stop", kind: "lightrail", mode: "lightrail" }],
  },
  {
    title: "NSW TrainLink Regional Trains",
    rows: [{ label: "By Station", kind: "train", mode: "train" }],
  },
  {
    title: "Sydney & Regional School Buses",
    rows: [{ label: "By Route", kind: "bus", mode: "bus", flow: "route" }],
  },
];

export default function NewTripScreen() {
  const { tripPlanner } = useAppFeatures();
  const goBack = useSafeBack();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const openStation = (mode: PickerMode, flow?: string) => {
    if (mode === "bus" && flow === "route") {
      router.push("/bus-route-picker" as never);
      return;
    }
    router.push({
      pathname: "/station-picker",
      params: { role: "from", mode, ...(flow ? { flow } : {}) },
    } as never);
  };

  return (
    <FeatureGate enabled={tripPlanner} title="Trip planner unavailable" message="Trip planning is turned off in admin settings.">
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ModalHeader title="New Trip" onClose={goBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: getStackContentClearance(insets.bottom),
        }}
      >
        <Txt
          size={15}
          color={c.textSecondary}
          style={{
            paddingHorizontal: SPACING.screen,
            paddingTop: 12,
            paddingBottom: 4,
            lineHeight: 22,
          }}
        >
          Choose how you want to plan your journey.
        </Txt>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <SectionHeader title={section.title} />
            <GroupedList separatorInset={LIST_TRANSPORT_SEPARATOR}>
              {section.rows.map((row) =>
                row.pin ? (
                  <TransportMenuRowPin
                    key={row.label}
                    label={row.label}
                    onPress={() => openStation(row.mode, row.flow)}
                  />
                ) : (
                  <TransportMenuRow
                    key={row.label}
                    label={row.label}
                    kind={row.kind ?? "train"}
                    onPress={() => openStation(row.mode, row.flow)}
                  />
                )
              )}
            </GroupedList>
          </View>
        ))}
      </ScrollView>
    </View>
    </FeatureGate>
  );
}
