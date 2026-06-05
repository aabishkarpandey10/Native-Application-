import { ChevronLeft } from "lucide-react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { MIN_TOUCH_TARGET } from "../../constants/layout";

interface StackHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  trailing?: React.ReactNode;
}

export function StackHeader({ title, subtitle, onBack, trailing }: StackHeaderProps) {
  return (
    <View
      className="px-5 pb-4 border-b border-surface-border bg-surface-base"
      style={{ paddingTop: Platform.OS === "android" ? 8 : 4 }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: "center" }}
        className="flex-row items-center self-start mb-2 -ml-1"
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ChevronLeft size={22} color="#0A84FF" strokeWidth={2.25} />
        <Text className="text-brand-primary text-base font-medium ml-0.5">Back</Text>
      </Pressable>

      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 min-w-0">
          <Text
            className="text-white font-bold tracking-tight"
            style={{ fontSize: Platform.OS === "ios" ? 28 : 26, lineHeight: Platform.OS === "ios" ? 34 : 32 }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-zinc-500 text-sm mt-1 leading-5">{subtitle}</Text>
          ) : null}
        </View>
        {trailing ? <View className="shrink-0">{trailing}</View> : null}
      </View>
    </View>
  );
}
