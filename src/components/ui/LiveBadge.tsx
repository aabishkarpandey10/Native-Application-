import { Text, View } from "react-native";

interface LiveBadgeProps {
  minutes?: number;
  delayed?: boolean;
}

export function LiveBadge({ minutes, delayed }: LiveBadgeProps) {
  if (minutes === undefined) return null;
  const label = minutes <= 0 ? "Now" : `${minutes} min`;
  const isNow = minutes <= 0;

  return (
    <View
      className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0 ${
        delayed
          ? "bg-red-500/10 border-red-500/25"
          : isNow
            ? "bg-brand-secondary/12 border-brand-secondary/25"
            : "bg-surface-elevated border-surface-border"
      }`}
    >
      {!delayed ? (
        <View
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: isNow ? "#30D158" : "#0A84FF" }}
        />
      ) : null}
      <Text
        className={`text-xs font-semibold ${
          delayed ? "text-red-400" : isNow ? "text-brand-secondary" : "text-zinc-200"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
