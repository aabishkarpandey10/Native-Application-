import type { Station } from "../constants/stations";

export interface StationSection {
  title: string;
  data: Station[];
}

export function buildStationSections(
  stations: Station[],
  filter?: (s: Station) => boolean
): StationSection[] {
  const list = filter ? stations.filter(filter) : [...stations];
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const byLetter = new Map<string, Station[]>();
  for (const s of list) {
    const letter = /^[A-Za-z]/.test(s.name) ? s.name[0]!.toUpperCase() : "#";
    if (!byLetter.has(letter)) byLetter.set(letter, []);
    byLetter.get(letter)!.push(s);
  }

  return [...byLetter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

export function stationIndexLetters(sections: StationSection[]): string[] {
  return sections.map((s) => s.title);
}
