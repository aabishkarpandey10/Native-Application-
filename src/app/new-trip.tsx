import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "../hooks/useSafeBack";
import { ModalHeader } from "../components/tripview/ModalHeader";
import {
  TransportMenuRow,
  TransportMenuRowPin,
  type TransportKind,
} from "../components/tripview/TransportMenuRow";
import { GroupedList, SectionHeader, Txt } from "../components/design";
import { STACK_SCROLL_BOTTOM_PADDING } from "../constants/layout";
import { useColors } from "../hooks/useColors";

type PickerMode = "train" | "metro" | "bus" | "ferry" | "lightrail";

interface TripSection {
  title: string;
  rows: { label: string; kind?: TransportKind; pin?: boolean; mode: PickerMode }[];
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
      { label: "By Route", kind: "bus", mode: "bus" },
      { label: "By Suburb", kind: "bus", mode: "bus" },
      { label: "By Stop", pin: true, mode: "bus" },
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
    rows: [{ label: "By Route", kind: "bus", mode: "bus" }],
  },
];

export default function NewTripScreen() {
  const goBack = useSafeBack();
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  const openStation = (mode: PickerMode) => {
    router.push({
      pathname: "/station-picker",
      params: { role: "from", mode },
    } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.isDark ? "light" : "dark"} />
      <ModalHeader title="New Trip" onClose={goBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 4,
          paddingBottom: insets.bottom + STACK_SCROLL_BOTTOM_PADDING,
        }}
      >
        <Txt
          size={15}
          color={c.textSecondary}
          style={{
            paddingHorizontal: 20,
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
            <GroupedList inset={16} separatorInset={60}>
              {section.rows.map((row) =>
                row.pin ? (
                  <TransportMenuRowPin
                    key={row.label}
                    label={row.label}
                    onPress={() => openStation(row.mode)}
                  />
                ) : (
                  <TransportMenuRow
                    key={row.label}
                    label={row.label}
                    kind={row.kind ?? "train"}
                    onPress={() => openStation(row.mode)}
                  />
                )
              )}
            </GroupedList>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
