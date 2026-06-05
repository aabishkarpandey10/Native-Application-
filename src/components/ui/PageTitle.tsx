import { ReactNode } from "react";
import { Platform, Text, View } from "react-native";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageTitle({ title, subtitle, action, className = "" }: PageTitleProps) {
  return (
    <View
      className={`flex-row items-start justify-between mb-1 ${className}`}
      style={{ paddingTop: Platform.OS === "android" ? 4 : 0 }}
    >
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
      {action ? <View className="shrink-0 pt-0.5">{action}</View> : null}
    </View>
  );
}
