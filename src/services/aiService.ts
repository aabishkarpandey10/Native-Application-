import { Platform } from "react-native";
import { fetchBackendRaw } from "./apiClient";
import { ServiceAlert } from "./tfnsw";
import { SavedStation } from "../store/store";
import type { AssistantLiveBoard } from "../types/assistantLive";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AssistantContext {
  userLocation: { lat: number; lng: number };
  favorites: SavedStation[];
  recentAlerts: ServiceAlert[];
  currentTime: Date;
}

export type AskAssistantResult = {
  text: string;
  liveSnapshot?: AssistantLiveBoard | null;
  source?: string | null;
  liveAsOf?: string | null;
};

const AI_TIMEOUT_MS = 20_000;

export type AskAssistantOptions = {
  onDelta?: (chunk: string, fullText: string) => void;
  onStatus?: (status: string) => void;
  onLiveSnapshot?: (snapshot: AssistantLiveBoard) => void;
  onLiveContext?: (ctx: { liveSnapshot: AssistantLiveBoard; source?: string }) => void;
};

export async function askAssistant(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  options?: AskAssistantOptions
): Promise<AskAssistantResult> {
  const messages = [
    ...conversationHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const body = JSON.stringify({
    messages,
    context: { ...context, currentTime: context.currentTime.toISOString() },
    stream: Platform.OS === "web" && !!options?.onDelta,
  });

  const useStream = Platform.OS === "web" && !!options?.onDelta;

  try {
    options?.onStatus?.("Fetching live data");

    const res = await fetchBackendRaw("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      timeoutMs: AI_TIMEOUT_MS,
      throwOnError: false,
    });

    if (!res) {
      return { text: buildOfflineFallback(userMessage, context) };
    }

    if (useStream && res.body) {
      const streamed = await readSseStream(res, options);
      if (streamed) return streamed;
    }

    const data = await res.json();
    if (data.liveSnapshot) {
      options?.onLiveSnapshot?.(data.liveSnapshot);
      options?.onLiveContext?.({ liveSnapshot: data.liveSnapshot, source: data.source });
    }
    if (data.response) {
      return {
        text: data.response,
        liveSnapshot: data.liveSnapshot ?? null,
        source: data.source ?? null,
        liveAsOf: data.liveAsOf ?? data.liveSnapshot?.asOf ?? null,
      };
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      console.warn("AI backend unreachable:", e);
    }
  }

  return { text: buildOfflineFallback(userMessage, context) };
}

async function readSseStream(
  res: Response,
  options?: AskAssistantOptions
): Promise<AskAssistantResult | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let liveSnapshot: AssistantLiveBoard | null = null;
  let source: string | null = null;
  let liveAsOf: string | null = null;

  options?.onStatus?.("Thinking");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const json = JSON.parse(line.slice(5).trim());
        if (json.type === "context" && json.liveSnapshot) {
          liveSnapshot = json.liveSnapshot;
          source = json.source ?? null;
          liveAsOf = json.liveSnapshot.asOf ?? null;
          options?.onLiveSnapshot?.(json.liveSnapshot);
          options?.onLiveContext?.({ liveSnapshot: json.liveSnapshot, source: source ?? undefined });
          options?.onStatus?.("Using live data");
        }
        if (json.type === "token" && json.content) {
          full += json.content;
          options?.onDelta?.(json.content, full);
        }
        if (json.type === "done") {
          if (json.liveSnapshot) {
            liveSnapshot = json.liveSnapshot;
            options?.onLiveSnapshot?.(json.liveSnapshot);
            liveAsOf = json.liveSnapshot.asOf ?? liveAsOf;
          }
          if (json.source) source = json.source;
          if (full) {
            return { text: full, liveSnapshot, source, liveAsOf };
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return full ? { text: full, liveSnapshot, source, liveAsOf } : null;
}

function buildOfflineFallback(message: string, context: AssistantContext): string {
  const lower = message.toLowerCase();
  const timeStr = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(
    context.currentTime
  );

  if (lower.includes("trackwork") || lower.includes("delay")) {
    const alerts = context.recentAlerts.filter((a) => a.severity !== "info");
    if (alerts.length) {
      return `${alerts.map((a) => a.title).join(". ")} (${timeStr}).`;
    }
    return `No major delays in cached data (${timeStr}).`;
  }
  if (lower.includes("ferry") || lower.includes("manly")) {
    const ferryAlert = context.recentAlerts.find(
      (a) => a.mode === "ferry" || a.title.toLowerCase().includes("ferry")
    );
    if (ferryAlert) {
      return `${ferryAlert.title} — ${ferryAlert.description} (${timeStr}).`;
    }
    return `Check the Ferries section above or Alerts tab (${timeStr}).`;
  }
  if (lower.includes("bus")) {
    return `Check the Buses section above for live departures (${timeStr}).`;
  }
  if (lower.includes("light rail") || lower.includes("tram")) {
    return `Check the Light rail section above (${timeStr}).`;
  }
  if (lower.includes("metro")) {
    return `Check the **Metro** section on Live boards (${timeStr}).`;
  }
  if (lower.includes("train")) {
    return `Check the **Train** section on Live boards (${timeStr}).`;
  }
  if (lower.includes("nearby") || lower.includes("departure")) {
    return `Use the live sections above — refreshed every 45s (${timeStr}). Start the backend if empty.`;
  }
  if (lower.includes("central") || lower.includes("fastest")) {
    return `Use **Routes** to plan to Central (${timeStr}). City Circle trains run frequently.`;
  }
  if (lower.includes("hello") || lower.includes("hi")) {
    return `Hi! Scroll the live boards by mode above, or ask about trains, buses, ferries, or light rail (${timeStr}).`;
  }
  return `Use the **Trains**, **Light rail**, **Ferries**, and **Buses** sections above (${timeStr}), or ask a specific question.`;
}

class AiService {
  async generateDisruptionSummary(alerts: ServiceAlert[]): Promise<string> {
    if (alerts.length === 0) {
      return "All Sydney transit networks are currently operating normally.";
    }
    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;
    let summary = `${alerts.length} active alert(s). `;
    if (criticalCount) summary += `${criticalCount} critical. `;
    if (warningCount) summary += `${warningCount} advisory. `;
    alerts.forEach((a) => {
      summary += `\n• ${a.mode}: ${a.title}`;
    });
    return summary;
  }

  predictDepartureReminder(scheduledDeparture: Date, delayMinutes: number, walkingTimeMinutes: number) {
    const adjusted = new Date(scheduledDeparture.getTime() + delayMinutes * 60000);
    const leaveTime = new Date(adjusted.getTime() - (walkingTimeMinutes + 2) * 60000);
    const fmt = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" });
    return {
      leaveTime,
      message: `Leave at ${fmt.format(leaveTime)} for ${fmt.format(adjusted)}${delayMinutes ? ` (+${delayMinutes}m delay)` : ""}.`,
    };
  }
}

export const aiService = new AiService();
export default aiService;
