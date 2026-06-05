import { Switch, TextInput, View } from "react-native";
import { Txt } from "../design";
import { interFamily } from "../../constants/design";
import { useColors } from "../../hooks/useColors";

export function AdminField({
  label,
  value,
  onChange,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const c = useColors();
  return (
    <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
      <Txt size={13} color={c.textSecondary} style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      {hint ? (
        <Txt size={11} color={c.textSecondary} style={{ marginBottom: 6 }}>
          {hint}
        </Txt>
      ) : null}
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={c.textSecondary}
        style={{
          fontSize: 16,
          color: c.text,
          fontFamily: interFamily("400"),
          minHeight: multiline ? 72 : undefined,
          textAlignVertical: multiline ? "top" : "center",
          backgroundColor: c.muted,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 8,
          borderWidth: 1,
          borderColor: c.separator,
        }}
      />
    </View>
  );
}

export function AdminSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: c.separator,
      }}
    >
      <Txt size={16} color={c.text} style={{ flex: 1, paddingRight: 12 }}>
        {label}
      </Txt>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: c.separator, true: c.primary }} />
    </View>
  );
}

export function AdminNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  return (
    <View style={{ padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
      <Txt size={13} color={c.textSecondary} style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <TextInput
        value={value === undefined || value === null ? "" : String(value)}
        onChangeText={(t) => onChange(Number.parseInt(t, 10) || 0)}
        keyboardType="number-pad"
        placeholderTextColor={c.textSecondary}
        style={{
          fontSize: 16,
          color: c.text,
          fontFamily: interFamily("400"),
          backgroundColor: c.muted,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: c.separator,
        }}
      />
    </View>
  );
}
