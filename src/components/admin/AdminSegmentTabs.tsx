import { Pressable, ScrollView, View } from "react-native";
import { Txt } from "../design";
import { SPACING } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

export function AdminSegmentTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  const c = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: SPACING.screen, gap: 8, paddingVertical: 10 }}
    >
      {tabs.map((t) => {
        const selected = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{
              paddingHorizontal: SPACING.cell,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: selected ? c.primary : c.card,
              borderWidth: 1,
              borderColor: selected ? c.primary : c.separator,
              minHeight: 40,
              justifyContent: "center",
            }}
          >
            <Txt size={14} weight={selected ? "600" : "400"} color={selected ? "#FFFFFF" : c.text}>
              {t.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function AdminStatRow({
  items,
}: {
  items: { label: string; value: string; tone?: "default" | "warn" | "ok" }[];
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: SPACING.screen, gap: 10, marginBottom: 4 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: c.separator,
          }}
        >
          <Txt size={22} weight="700" color={item.tone === "warn" ? "#FF9500" : item.tone === "ok" ? "#34C759" : c.text}>
            {item.value}
          </Txt>
          <Txt size={12} color={c.textSecondary} style={{ marginTop: 4 }}>
            {item.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
