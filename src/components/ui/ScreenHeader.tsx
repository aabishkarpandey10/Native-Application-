import { ReactNode } from "react";
import { Text, View } from "react-native";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  action?: ReactNode;
}

export function ScreenHeader({ title, subtitle, icon, action }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between py-3 mb-2">
      <View className="flex-row items-center gap-3 flex-1 min-w-0 pr-2">
        <View className="w-10 h-10 rounded-xl bg-brand-primary/12 border border-brand-primary/20 items-center justify-center shrink-0">
          {icon}
        </View>
        <View className="flex-1 min-w-0">
          <Text
            className="text-xl font-bold text-white tracking-tight leading-tight"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-zinc-500 text-sm mt-0.5 leading-5" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {action ? <View className="shrink-0">{action}</View> : null}
    </View>
  );
}
