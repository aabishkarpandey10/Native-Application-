import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { HAIRLINE, MIN_TOUCH, titleWeight } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";

/** Modal / sheet header — safe area, centered title, close control. */
export function ModalHeader({
  title,
  onClose,
  primary = false,
}: {
  title: string;
  onClose: () => void;
  primary?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const fg = primary ? c.headerText : c.text;
  const closeColor = primary ? c.headerText : c.text;

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: primary ? c.header : c.card,
        borderBottomWidth: primary ? 0 : HAIRLINE,
        borderBottomColor: c.separator,
      }}
    >
      {!primary ? (
        <View
          style={{
            alignSelf: "center",
            width: 36,
            height: 5,
            borderRadius: 3,
            backgroundColor: c.separator,
            marginTop: 8,
            marginBottom: 4,
          }}
        />
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: MIN_TOUCH,
          paddingHorizontal: 8,
          paddingBottom: 10,
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={{
            width: MIN_TOUCH,
            height: MIN_TOUCH,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={22} color={closeColor} strokeWidth={2.2} />
        </Pressable>

        <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
          <Txt
            size={17}
            weight={titleWeight()}
            color={fg}
            numberOfLines={1}
          >
            {title}
          </Txt>
        </View>

        <View style={{ width: MIN_TOUCH }} />
      </View>
    </View>
  );
}
