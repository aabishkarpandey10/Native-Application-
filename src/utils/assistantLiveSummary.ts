import { LIVE_MODE_ORDER, type AssistantLiveBoard } from "../types/assistantLive";
import { formatSydneyTime } from "./tfnswTime";

export function formatLiveAsOf(iso: string | undefined) {
  if (!iso) return "";
  try {
    return formatSydneyTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

/** One-line highlights for welcome / status (next dep per mode). */
export function buildLiveHighlights(board: AssistantLiveBoard | null | undefined, max = 4): string[] {
  if (!board?.byMode) return [];
  const lines: string[] = [];
  for (const { key, label } of LIVE_MODE_ORDER) {
    const section = board.byMode[key];
    const dep = section?.stops?.[0]?.next_departures?.[0];
    if (!dep) continue;
    lines.push(
      `${label}: ${dep.route} → ${dep.destination} in ${dep.label}${dep.delayMinutes > 0 ? ` (+${dep.delayMinutes}m)` : ""}`
    );
    if (lines.length >= max) break;
  }
  return lines;
}

export function buildWelcomeMessage(board: AssistantLiveBoard | null | undefined): string {
  const when = formatLiveAsOf(board?.asOf);
  const live = board?.tfnswLive;
  const highlights = buildLiveHighlights(board, 3);

  let msg = live
    ? `I'm connected to **live TfNSW data**${when ? ` (updated ${when})` : ""}. Every answer uses fresh departures and alerts—not cached timetables.`
    : `I'm using **scheduled timetables** right now. Start the backend with a TfNSW key for live departures.`;

  if (highlights.length) {
    msg += `\n\nRight now near you:\n${highlights.map((h) => `• ${h}`).join("\n")}`;
  }

  msg += "\n\nAsk about delays, a specific mode, or tap a quick prompt below.";
  return msg;
}

export function countActiveAlerts(board: AssistantLiveBoard | null | undefined): number {
  if (!board?.alertsByMode) return 0;
  return Object.values(board.alertsByMode).reduce((n, list) => n + (list?.length ?? 0), 0);
}
