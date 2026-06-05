/** Official Sydney Trains / intercity line colours (matches frontend trainNetworks). */
export const SYDNEY_LINE_COLORS = {
  T1: "#F6891F",
  T2: "#80CC28",
  T3: "#F37021",
  T4: "#0072CE",
  T5: "#C41230",
  T6: "#717430",
  T7: "#6F2C91",
  T8: "#009374",
  T9: "#D11919",
  CCN: "#F6891F",
  BMT: "#F6891F",
  SCO: "#0072CE",
  HUN: "#833134",
  SPL: "#00954C",
  M1: "#0095A0",
};

const LINE_CODE_RE = /\b(T\d+|M\d+|L\d+|F\d+|CCN|BMT|SCO|HUN|SPL)\b/i;

export function extractSydneyLineCode(transportation) {
  if (!transportation) return "—";
  const direct = String(transportation.number || "").trim();
  if (direct && direct !== "-") return direct;

  const sources = [
    transportation.disassembledName,
    transportation.name,
  ].filter(Boolean);

  for (const src of sources) {
    const text = String(src).trim();
    const word = text.match(LINE_CODE_RE);
    if (word) return word[1].toUpperCase();
    const lead = text.match(/^(T\d+|M\d+|L\d+|F\d+|CCN|BMT|SCO|HUN|SPL)\b/i);
    if (lead) return lead[1].toUpperCase();
    const busLead = text.match(/^(\d{1,4}[A-Z]?|X\d+[A-Z]?)\b/i);
    if (busLead) return busLead[1].toUpperCase();
    const busWord = text.match(/\b(\d{1,4}[A-Z]?|X\d+[A-Z]?)\b/i);
    if (busWord) return busWord[1].toUpperCase();
  }
  return "—";
}

export function getLineColor(route) {
  const code = String(route || "").toUpperCase();
  return SYDNEY_LINE_COLORS[code] || "#555555";
}
