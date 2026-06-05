/**
 * Sydney Transit AI — live context + rules + optional OpenAI (streaming)
 */

import { formatSydneyTime } from "./data/tfnswTime.js";

const OPENAI_TIMEOUT_MS = 12_000;

export function tryInstantResponse(messages, context = {}) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const alerts = context.recentAlerts || [];
  const favorites = context.favorites || [];
  const snapshot = context.liveSnapshot;
  const time = context.currentTime ? new Date(context.currentTime) : new Date();
  const timeStr = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
  }).format(time);

  const reply = buildRuleBasedResponse(lower, text, alerts, favorites, timeStr, snapshot);
  const isGeneric =
    reply.startsWith("I can help with Sydney transit") ||
    reply.startsWith("Hello! I'm your Sydney Transit assistant");

  if (isGeneric && shouldUseOpenAi(lower, text)) return null;
  return reply;
}

function shouldUseOpenAi(lower, text) {
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  if (text.length > 100) return true;
  return /\b(why|explain|compare|recommend|suggest|plan my|help me|what is the best|how do i)\b/.test(
    lower
  );
}

export async function buildAiChatResponse(messages, context = {}) {
  const instant = tryInstantResponse(messages, context);
  if (instant) return { text: instant, source: "instant" };

  if (process.env.OPENAI_API_KEY) {
    const openAi = await callOpenAi(messages, context);
    if (openAi) return { text: openAi, source: "openai" };
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = (lastUser?.content || "").trim();
  const lower = text.toLowerCase();
  const alerts = context.recentAlerts || [];
  const favorites = context.favorites || [];
  const timeStr = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
  }).format(context.currentTime ? new Date(context.currentTime) : new Date());

  return {
    text: buildRuleBasedResponse(lower, text, alerts, favorites, timeStr, context.liveSnapshot),
    source: "rules",
  };
}

/** Stream tokens to Express response (SSE) */
export async function streamAiChatResponse(messages, context, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  if (context.liveSnapshot) {
    send({
      type: "context",
      liveSnapshot: context.liveSnapshot,
      source: "live-enriched",
      liveAsOf: context.liveSnapshot.asOf,
      tfnswLive: context.liveSnapshot.tfnswLive,
    });
  }

  const instant = tryInstantResponse(messages, context);
  if (instant) {
    send({ type: "token", content: instant });
    send({ type: "done", source: "instant", liveSnapshot: context.liveSnapshot });
    res.end();
    return;
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    const result = await buildAiChatResponse(messages, context);
    send({ type: "token", content: result.text });
    send({ type: "done", source: result.source, liveSnapshot: context.liveSnapshot });
    res.end();
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(context);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-6).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ],
        max_tokens: 320,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!oaiRes.ok || !oaiRes.body) {
      throw new Error(`OpenAI HTTP ${oaiRes.status}`);
    }

    const reader = oaiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) send({ type: "token", content: delta });
        } catch {
          /* skip malformed chunk */
        }
      }
    }

    send({ type: "done", source: "openai-stream", liveSnapshot: context.liveSnapshot });
    res.end();
  } catch (e) {
    console.warn("AI stream failed:", e.message);
    const fallback = await buildAiChatResponse(messages, context);
    send({ type: "token", content: fallback.text });
    send({ type: "done", source: fallback.source, liveSnapshot: context.liveSnapshot });
    res.end();
  }
}

async function callOpenAi(messages, context) {
  const systemPrompt = buildSystemPrompt(context);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-6).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ],
        max_tokens: 320,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } catch (e) {
    console.warn("OpenAI call failed:", e.message);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function buildSystemPrompt(context) {
  const alerts = context.recentAlerts || [];
  const favorites = context.favorites || [];
  const snapshot = context.liveSnapshot;
  const timeStr = formatSydneyTime(context.currentTime || new Date(), {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  let prompt = `You are Sydney Transit AI for Sydney, Australia. Current Sydney time: ${timeStr}.
Answer using ONLY the live data below. If data is missing, say what to check in the app (Alerts, Routes, station boards).
Be concise (2-5 sentences). Use bullet points for lists. Mention route numbers and countdown minutes when available.`;

  if (snapshot) {
    prompt += `\n\nData source: ${snapshot.dataSource} (fetched ${formatSydneyTime(snapshot.asOf)}). TfNSW live: ${snapshot.tfnswLive ? "yes" : "no"}.`;
  }

  if (alerts.length) {
    prompt += `\n\nService alerts (${alerts.length}):`;
    for (const a of alerts.slice(0, 8)) {
      prompt += `\n- [${a.severity}] ${a.mode} ${a.title}: ${a.description}`;
    }
  } else {
    prompt += `\n\nNo active service alerts in the feed.`;
  }

  if (snapshot?.byMode) {
    prompt += `\n\nLive boards by mode (use these for mode-specific questions):`;
    for (const [key, section] of Object.entries(snapshot.byMode)) {
      const modeAlerts = snapshot.alertsByMode?.[key] || [];
      prompt += `\n\n## ${section.label}`;
      if (modeAlerts.length) {
        prompt += `\nAlerts: ${modeAlerts.map((a) => `${a.title} (${a.severity})`).join("; ")}`;
      }
      if (!section.stops?.length) {
        prompt += `\nNo nearby stops in range.`;
        continue;
      }
      for (const n of section.stops) {
        const deps = n.next_departures?.length
          ? n.next_departures
              .map(
                (d) =>
                  `${d.route} to ${d.destination} in ${d.label}${d.delayMinutes ? ` (+${d.delayMinutes}m delay)` : ""}`
              )
              .join("; ")
          : "no departures listed";
        prompt += `\n- ${n.station_name} (${n.distance_meters}m): ${deps}`;
      }
    }
  } else if (snapshot?.nearby?.length) {
    prompt += `\n\nNearby stops (live boards):`;
    for (const n of snapshot.nearby) {
      const deps = n.next_departures?.length
        ? n.next_departures
            .map((d) => `${d.route} to ${d.destination} in ${d.label}${d.delayMinutes ? ` (+${d.delayMinutes}m delay)` : ""}`)
            .join("; ")
        : "no departures listed";
      prompt += `\n- ${n.station_name} (${n.distance_meters}m, ${n.mode}): ${deps}`;
    }
  }

  if (snapshot?.favorites?.length) {
    prompt += `\n\nSaved station boards:`;
    for (const f of snapshot.favorites) {
      const deps = f.next_departures?.length
        ? f.next_departures
            .map((d) => `${d.route} to ${d.destination} in ${d.label}`)
            .join("; ")
        : "no departures";
      prompt += `\n- ${f.station_name}: ${deps}`;
    }
  } else if (favorites.length) {
    prompt += `\n\nSaved stations: ${favorites.map((f) => f.station_name).join(", ")}.`;
  }

  return prompt;
}

function normalizeMode(mode) {
  return String(mode || "")
    .toLowerCase()
    .replace(/_/g, "");
}

function findModeDepartures(snapshot, modeNeedle) {
  if (!snapshot) return [];
  const needle = normalizeMode(modeNeedle);
  const out = [];

  const sectionKey =
    needle.includes("ferry") ? "ferry"
    : needle.includes("bus") ? "bus"
    : needle.includes("light") ? "lightrail"
    : "train";

  const section = snapshot.byMode?.[sectionKey];
  if (section?.stops?.length) {
    for (const board of section.stops) {
      for (const d of board.next_departures || []) {
        out.push({ station: board.station_name, ...d });
      }
    }
  }

  for (const board of snapshot.favorites || []) {
    if (normalizeMode(board.mode).includes(needle) || needle.includes(normalizeMode(board.mode))) {
      for (const d of board.next_departures || []) {
        out.push({ station: board.station_name, ...d });
      }
    }
  }

  if (!out.length) {
    for (const board of snapshot.nearby || []) {
      if (normalizeMode(board.mode).includes(needle) || needle.includes(normalizeMode(board.mode))) {
        for (const d of board.next_departures || []) {
          out.push({ station: board.station_name, ...d });
        }
      }
    }
  }

  return out.slice(0, 8);
}

function formatModeSection(snapshot, sectionKey, timeStr, dataNote) {
  const section = snapshot?.byMode?.[sectionKey];
  if (!section) return null;
  const alerts = snapshot.alertsByMode?.[sectionKey] || [];
  let r = `${section.label} (${timeStr})${dataNote}:\n`;
  if (alerts.length) {
    r += `Alerts:\n${alerts.map((a) => `• [${a.severity}] ${a.title}`).join("\n")}\n`;
  }
  const deps = [];
  for (const stop of section.stops || []) {
    for (const d of stop.next_departures || []) {
      deps.push({ station: stop.station_name, ...d });
    }
  }
  if (deps.length) {
    r += `Departures:\n${formatDepartureLines(deps.slice(0, 6))}`;
  } else if (!alerts.length) {
    r += "No departures in range — try the Map tab or move closer to a stop.";
  }
  return r.trim();
}

function formatDepartureLines(deps) {
  if (!deps.length) return "";
  return deps
    .map((d) => `• ${d.station}: ${d.route} to ${d.destination} — ${d.label}${d.delayMinutes ? ` (+${d.delayMinutes}m)` : ""}`)
    .join("\n");
}

function buildRuleBasedResponse(lower, text, alerts, favorites, timeStr, snapshot) {
  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const dataNote = snapshot
    ? `\n(${snapshot.dataSource}, updated ${formatSydneyTime(snapshot.asOf)})`
    : "";

  if (lower.includes("ferry") || lower.includes("swell") || lower.includes("manly") || lower.includes("wharf")) {
    const section = formatModeSection(snapshot, "ferry", timeStr, dataNote);
    if (section) return section;
  }

  if (lower.includes("bus") || lower.includes("b-line") || lower.includes("b line")) {
    const section = formatModeSection(snapshot, "bus", timeStr, dataNote);
    if (section) return section;
  }

  if (lower.includes("light rail") || lower.includes("lightrail") || lower.includes("tram")) {
    const section = formatModeSection(snapshot, "lightrail", timeStr, dataNote);
    if (section) return section;
  }

  if (lower.includes("metro") || lower.includes("m1") || /\bm\d\b/.test(lower)) {
    const section = formatModeSection(snapshot, "metro", timeStr, dataNote);
    if (section) return section;
  }

  if (
    lower.includes("train") ||
    /\bt\d\b/.test(lower) ||
    lower.includes("t1") ||
    lower.includes("t8") ||
    lower.includes("sydney trains")
  ) {
    const section = formatModeSection(snapshot, "train", timeStr, dataNote);
    if (section) return section;
  }

  if (
    lower.includes("trackwork") ||
    lower.includes("delay") ||
    lower.includes("disrupt") ||
    lower.includes("alert")
  ) {
    let r = `Network status as of ${timeStr}${dataNote}:\n\n`;
    if (critical.length) {
      r += `Critical:\n${critical.map((a) => `• ${a.title} — ${a.description}`).join("\n")}\n`;
    }
    if (warnings.length) {
      r += `Advisories:\n${warnings.map((a) => `• ${a.title} — ${a.description}`).join("\n")}\n`;
    }
    if (!critical.length && !warnings.length) {
      r += "No critical or warning alerts right now. Check the Alerts tab for info-level notices.";
    }
    const liveDeps = findModeDepartures(snapshot, "train");
    if (liveDeps.length) {
      r += `\nLive nearby trains:\n${formatDepartureLines(liveDeps)}`;
    }
    return r.trim();
  }

  if (
    lower.includes("nearby") ||
    lower.includes("next train") ||
    lower.includes("next bus") ||
    lower.includes("when") ||
    lower.includes("departure") ||
    lower.includes("what's leaving")
  ) {
    if (snapshot?.byMode) {
      let r = `Live nearby (${timeStr})${dataNote}:\n`;
      for (const key of ["train", "metro", "lightrail", "ferry", "bus"]) {
        const block = formatModeSection(snapshot, key, timeStr, "");
        if (block) r += `\n${block}\n`;
      }
      return r.trim();
    }
    if (snapshot?.nearby?.length) {
      let r = `Nearby live boards (${timeStr})${dataNote}:\n`;
      for (const n of snapshot.nearby.slice(0, 4)) {
        const deps = n.next_departures?.length
          ? n.next_departures
              .map((d) => `${d.route} → ${d.destination} (${d.label})`)
              .join(", ")
          : "no listed departures";
        r += `• ${n.station_name} (${n.distance_meters}m): ${deps}\n`;
      }
      return r.trim();
    }
  }

  if (lower.includes("fastest") || lower.includes("quick") || lower.includes("how do i get")) {
    const nearby = snapshot?.nearby?.[0];
    const hint = nearby?.next_departures?.[0]
      ? ` Nearest stop ${nearby.station_name}: ${nearby.next_departures[0].route} in ${nearby.next_departures[0].label}.`
      : "";
    if (lower.includes("central")) {
      return `To Central (${timeStr}): City Circle trains (T1/T2/T4/T8/T9) or Metro.${hint} Open **Routes** to plan from your location.`;
    }
    return `Open **Routes** to plan the fastest trip (${timeStr}).${hint}`;
  }

  if (lower.includes("central") || lower.includes("town hall") || lower.includes("cbd")) {
    const cbdDeps = findModeDepartures(snapshot, "train").filter((d) =>
      /central|town hall|martin|circular/i.test(d.station)
    );
    const depLine = cbdDeps.length ? `\n${formatDepartureLines(cbdDeps.slice(0, 3))}` : "";
    return `City stations (${timeStr}): Central & Town Hall — T1, T2, T4, T8, T9 + Metro.${depLine}`;
  }

  if (lower.includes("saved") || lower.includes("favourite") || lower.includes("favorite")) {
    if (snapshot?.favorites?.length) {
      let r = `Saved station boards (${timeStr})${dataNote}:\n`;
      for (const f of snapshot.favorites) {
        const deps = f.next_departures?.length
          ? f.next_departures.map((d) => `${d.route} → ${d.destination} (${d.label})`).join(", ")
          : "check station screen";
        r += `• ${f.station_name}: ${deps}\n`;
      }
      return r.trim();
    }
    if (favorites.length) {
      return `Saved (${timeStr}): ${favorites.map((f) => f.station_name).join(", ")}. Tap any for live departures.`;
    }
    return `No saved stations yet — star a stop on Map or Nearby.`;
  }

  if (lower.includes("hello") || lower.includes("hi") || lower === "hey") {
    const live = snapshot?.tfnswLive ? "TfNSW live data" : "scheduled timetables";
    return `Hi! Sydney Transit assistant (${timeStr}). I'm using ${live}. Ask about delays, nearby departures, or trip planning.`;
  }

  const sampleDeps = snapshot?.nearby?.[0]?.next_departures?.[0];
  const sample = sampleDeps
    ? ` Example nearby: ${snapshot.nearby[0].station_name} — ${sampleDeps.route} in ${sampleDeps.label}.`
    : "";

  return `Sydney Transit (${timeStr})${dataNote}.${sample}\n\nTry:\n• "Any trackwork today?"\n• "What's departing nearby?"\n• "Ferry delays?"\n\nUse **Routes** to plan trips.`;
}
