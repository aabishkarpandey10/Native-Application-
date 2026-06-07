import { getTrainLine, SYDNEY_TRAIN_LINES } from "../constants/trainNetworks";
import { getModeColor } from "../constants/transportModes";

const TRAIN_BG_CLASS: Record<string, string> = {
  T1: "bg-[#F6891F]",
  T2: "bg-[#80CC28]",
  T3: "bg-[#F37021]",
  T4: "bg-[#0072CE]",
  T5: "bg-[#C41230]",
  T6: "bg-[#717430]",
  T7: "bg-[#6F2C91]",
  T8: "bg-[#009374]",
  T9: "bg-[#D11919]",
  CCN: "bg-[#F6891F]",
  BMT: "bg-[#F6891F]",
  SCO: "bg-[#0072CE]",
  HUN: "bg-[#833134]",
  SPL: "bg-[#00954C]",
};

const EXTRA_LINE_HEX: Record<string, string> = {
  M1: "#0095A0",
  L1: "#E62B1E",
  L2: "#E62B1E",
  L3: "#E62B1E",
};

/** T8 Airport & South Line → T8; M1 Metro… → M1 */
export function compactRouteCode(route?: string): string {
  const raw = String(route ?? "").trim();
  if (!raw) return "—";
  const m = raw.match(/\b(T\d+|M\d+|L\d+|F\d+|[A-Z]{2,4}\d*)\b/i);
  if (m) return m[1].toUpperCase();
  if (/^\d+[A-Z]?$/i.test(raw)) return raw.toUpperCase();
  if (raw.length <= 4) return raw.toUpperCase();
  return raw.slice(0, 3).toUpperCase();
}

export function normalizeMode(mode: string): string {
  const m = (mode || "").toLowerCase().replace(/_/g, "");
  if (m === "lightrail") return "lightrail";
  return m;
}

export function getTrainLineHex(route?: string | number | null): string | undefined {
  const code = String(route ?? "").toUpperCase();
  if (!code) return undefined;
  return getTrainLine(code)?.color ?? EXTRA_LINE_HEX[code];
}

export function getRouteHexColor(
  mode: string,
  route?: string | number | null,
  lineColor?: string
): string {
  if (lineColor && /^#[0-9A-Fa-f]{6}$/.test(lineColor)) return lineColor;

  const m = normalizeMode(mode);
  const r = String(route ?? "").toUpperCase();

  if (m === "train" || /^T\d+$/.test(r) || /^(CCN|BMT|SCO|HUN|SPL)$/.test(r)) {
    return getTrainLineHex(r) ?? getModeColor("train");
  }
  if (m === "metro" || r.startsWith("M")) return getModeColor("metro");
  if (m === "ferry" || r.startsWith("F")) return getModeColor("ferry");
  if (m === "lightrail" || m === "light_rail" || r.startsWith("L")) return getModeColor("light_rail");
  return getModeColor("bus");
}

export function getRouteBg(mode: string, route?: string | number | null): string {
  const m = normalizeMode(mode);
  const r = String(route ?? "").toUpperCase();
  if (TRAIN_BG_CLASS[r]) return TRAIN_BG_CLASS[r];
  if (m === "train" || /^T\d+$/.test(r)) return "bg-transit-train";
  if (m === "metro" || r.startsWith("M")) return "bg-transit-metro";
  if (m === "ferry" || r.startsWith("F")) return "bg-transit-ferry";
  if (m === "lightrail" || r.startsWith("L")) return "bg-transit-lightrail";
  return "bg-transit-bus";
}

export function getRouteBadgeStyle(mode: string, route?: string, lineColor?: string) {
  return { backgroundColor: getRouteHexColor(mode, route, lineColor) };
}
