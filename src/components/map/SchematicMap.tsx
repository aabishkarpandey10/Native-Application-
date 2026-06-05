import { useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Stop as SvgStop,
} from "react-native-svg";
import { LineBadge, Txt } from "../design";
import { lineColor } from "../../constants/design";
import { normalizeStationId } from "../../constants/stationAliases";
import { useColors } from "../../hooks/useColors";

interface MapStation {
  id: string;
  name: string;
  fx: number;
  fy: number;
  lines: string[];
}

const STATIONS: MapStation[] = [
  { id: "CIRCULARQUAY_T", name: "Circular Quay", fx: 0.54, fy: 0.22, lines: ["T2", "T3"] },
  { id: "WYNYARD_T", name: "Wynyard", fx: 0.42, fy: 0.34, lines: ["T1", "T2", "T3"] },
  { id: "STJAMES_T", name: "St James", fx: 0.6, fy: 0.42, lines: ["T4"] },
  { id: "TOWNHALL_T", name: "Town Hall", fx: 0.4, fy: 0.45, lines: ["T1", "T2"] },
  { id: "MUSEUM_T", name: "Museum", fx: 0.56, fy: 0.52, lines: ["T4"] },
  { id: "CENTRAL_T", name: "Central", fx: 0.41, fy: 0.62, lines: ["T1", "T2", "T3", "T4", "T8"] },
  { id: "REDFERN_T", name: "Redfern", fx: 0.41, fy: 0.76, lines: ["T3"] },
];

export function SchematicMap({
  onStationSelect,
  selectedId,
}: {
  onStationSelect: (stationId: string) => void;
  selectedId?: string | null;
}) {
  const c = useColors();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const pt = (s: { fx: number; fy: number }, w: number, h: number) =>
    `${(s.fx * w).toFixed(1)},${(s.fy * h).toFixed(1)}`;
  const line = (ids: string[], w: number, h: number) =>
    ids
      .map((id) => STATIONS.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => pt(s as MapStation, w, h))
      .join(" ");

  return (
    <View style={{ flex: 1, backgroundColor: c.isDark ? "#0a1622" : "#d8ecf7" }} onLayout={onLayout}>
      {size ? (
        <>
          <Svg width={size.w} height={size.h}>
            <Defs>
              <RadialGradient id="bg" cx="40%" cy="28%" r="85%">
                <SvgStop offset="0%" stopColor={c.isDark ? "#16304a" : "#c8e6f5"} />
                <SvgStop offset="55%" stopColor={c.isDark ? "#0f2235" : "#d8ecf7"} />
                <SvgStop offset="100%" stopColor={c.isDark ? "#0a1622" : "#e4f0f8"} />
              </RadialGradient>
            </Defs>
            <Polygon points={`0,0 ${size.w},0 ${size.w},${size.h} 0,${size.h}`} fill="url(#bg)" />
            <Polygon
              points={`0,${size.h * 0.13} ${size.w * 0.3},${size.h * 0.1} ${size.w * 0.5},${size.h * 0.16} ${size.w * 0.7},${size.h * 0.09} ${size.w},${size.h * 0.14} ${size.w},0 0,0`}
              fill="rgba(90,184,232,0.85)"
            />
            <Ellipse
              cx={size.w * 0.66}
              cy={size.h * 0.47}
              rx={size.w * 0.085}
              ry={size.h * 0.085}
              fill="rgba(120,190,120,0.5)"
            />
            <Path
              d={`M${size.w * 0.36},${size.h * 0.14} Q${size.w * 0.54},${size.h * 0.06} ${size.w * 0.72},${size.h * 0.14}`}
              stroke={c.isDark ? "#9aa4b0" : "#6b7280"}
              strokeWidth={3}
              fill="none"
            />
            <Polyline
              points={line(["CIRCULARQUAY_T", "STJAMES_T", "MUSEUM_T"], size.w, size.h)}
              fill="none"
              stroke={lineColor("T4")}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Polyline
              points={line(["CENTRAL_T", "TOWNHALL_T", "WYNYARD_T", "CIRCULARQUAY_T"], size.w, size.h)}
              fill="none"
              stroke={lineColor("T2")}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Polyline
              points={line(["WYNYARD_T", "CENTRAL_T", "REDFERN_T"], size.w, size.h)}
              fill="none"
              stroke={lineColor("T3")}
              strokeWidth={5}
              strokeLinecap="round"
            />
            {STATIONS.map((s) => {
              const isSel = selectedId === s.id;
              return (
                <Circle
                  key={s.id}
                  cx={s.fx * size.w}
                  cy={s.fy * size.h}
                  r={isSel ? 11 : 8}
                  fill={lineColor(s.lines[0])}
                  stroke={isSel ? "#FFFFFF" : "#cccccc"}
                  strokeWidth={isSel ? 3 : 2}
                />
              );
            })}
          </Svg>
          {STATIONS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => onStationSelect(normalizeStationId(s.id))}
              style={{
                position: "absolute",
                left: s.fx * size.w - 20,
                top: s.fy * size.h - 20,
                width: 40,
                height: 40,
              }}
            />
          ))}
          {selectedId ? (
            <View
              style={{
                position: "absolute",
                top: 12,
                alignSelf: "center",
                backgroundColor: c.card,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Txt size={13} weight="600" color={c.text}>
                {STATIONS.find((s) => s.id === selectedId)?.name ?? "Selected"}
              </Txt>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                {STATIONS.find((s) => s.id === selectedId)?.lines.map((l) => (
                  <LineBadge key={l} route={l} small />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
