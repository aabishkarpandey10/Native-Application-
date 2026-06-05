import { Bot } from "lucide-react-native";
import { Text, View } from "react-native";
import { formatLiveAsOf } from "../../utils/assistantLiveSummary";

type Props = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  streaming?: boolean;
  liveAsOf?: string | null;
  dataSource?: string | null;
  tfnswLive?: boolean;
};

export function AssistantChatMessage({
  role,
  content,
  timestamp,
  streaming,
  liveAsOf,
  dataSource,
  tfnswLive,
}: Props) {
  const isAi = role === "assistant";
  if (streaming && !content) return null;

  return (
    <View className={`flex-row mb-3 ${isAi ? "justify-start" : "justify-end"}`}>
      {isAi && (
        <View className="w-8 h-8 bg-surface-card rounded-full items-center justify-center mr-2 border border-surface-border mt-0.5">
          <Bot size={16} color="#71717A" />
        </View>
      )}
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3.5 ${
          isAi
            ? "bg-surface-card border border-surface-border rounded-tl-md"
            : "bg-brand-primary rounded-tr-md"
        }`}
      >
        <Text className={`text-sm leading-5 ${isAi ? "text-zinc-200" : "text-white"}`}>
          {content}
          {streaming ? <Text className="text-brand-primary"> ▍</Text> : null}
        </Text>

        {isAi && !streaming && (liveAsOf || dataSource) ? (
          <View
            className={`mt-2.5 px-2 py-1 rounded-md self-start ${
              tfnswLive ? "bg-[#30D158]/10 border border-[#30D158]/20" : "bg-zinc-800/80"
            }`}
          >
            <Text
              className={`text-[10px] font-semibold ${
                tfnswLive ? "text-[#30D158]" : "text-zinc-500"
              }`}
            >
              {tfnswLive ? "● Live answer" : "○ Scheduled data"}
              {liveAsOf ? ` · ${formatLiveAsOf(liveAsOf)}` : ""}
            </Text>
          </View>
        ) : null}

        {!streaming ? (
          <Text
            className={`text-[10px] mt-2 text-right ${
              isAi ? "text-zinc-600" : "text-white/60"
            }`}
          >
            {new Intl.DateTimeFormat("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(timestamp)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
