import { Pressable, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { HAIRLINE, RADIUS, SEMANTIC, SPACING, cardShadow } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";
import { BRAND_ACCENT } from "../../utils/tripDisplay";
import { formatLeaveIn, shortStationName } from "../../utils/tripViewFormat";

export interface TripResultRowProps {
  leaveInMinutes: number;
  originName: string;
  destName: string;
  originPlatform?: string;
  viaLabel?: string;
  platformLabel?: string;
  departClock: string;
  arriveClock: string;
  routeCode: string;
  accentColor?: string;
  onTime?: boolean;
  realtime?: boolean;
  isPast?: boolean;
  onPress?: () => void;
}

/** Card-based journey option — separate from TripView sidebar layout. */
export function TripResultRow({
  leaveInMinutes,
  originName,
  destName,
  originPlatform,
  viaLabel,
  platformLabel = "Plat",
  departClock,
  arriveClock,
  routeCode,
  accentColor = BRAND_ACCENT,
  onTime = true,
  realtime = true,
  isPast = false,
  onPress,
}: TripResultRowProps) {
  const c = useColors();
  const leaveLabel = formatLeaveIn(leaveInMinutes);
  const routeColor = isPast ? c.textSecondary : accentColor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        marginHorizontal: SPACING.screen,
        marginBottom: SPACING.section,
        opacity: isPast ? 0.7 : pressed ? 0.94 : 1,
      })}
    >
      <View
        style={[
          {
            backgroundColor: c.card,
            borderRadius: RADIUS.card,
            borderWidth: HAIRLINE,
            borderColor: c.border,
            padding: SPACING.cell,
            overflow: "hidden",
          },
          cardShadow(c.isDark),
        ]}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: isPast ? c.separator : routeColor,
          }}
        />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: RADIUS.pill,
              backgroundColor: `${routeColor}18`,
              borderWidth: 1,
              borderColor: `${routeColor}33`,
            }}
          >
            <Txt size={12} weight="700" color={routeColor}>
              {routeCode}
            </Txt>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: RADIUS.pill,
              backgroundColor: c.muted,
            }}
          >
            <Txt size={12} weight="600" color={isPast ? c.textSecondary : c.text}>
              {leaveLabel}
            </Txt>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={12} color={c.textSecondary} numberOfLines={1}>
              {shortStationName(originName)}
              {originPlatform ? ` · ${platformLabel} ${originPlatform}` : ""}
            </Txt>
            <Txt
              size={24}
              weight="700"
              color={isPast ? c.textSecondary : c.text}
              tabularNums
              style={{ marginTop: 4 }}
            >
              {departClock}
            </Txt>
          </View>

          <View style={{ paddingHorizontal: 12, alignItems: "center" }}>
            <ArrowRight size={18} color={isPast ? c.separator : c.textSecondary} strokeWidth={2} />
          </View>

          <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
            <Txt size={12} color={c.textSecondary} numberOfLines={1} style={{ textAlign: "right" }}>
              {shortStationName(destName)}
            </Txt>
            <Txt
              size={24}
              weight="700"
              color={isPast ? c.textSecondary : c.text}
              tabularNums
              style={{ marginTop: 4 }}
            >
              {arriveClock}
            </Txt>
          </View>
        </View>

        {viaLabel ? (
          <Txt size={12} color={c.textSecondary} numberOfLines={1} style={{ marginTop: 10 }}>
            {viaLabel}
          </Txt>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: viaLabel ? 8 : 14, gap: 6 }}>
          {onTime && realtime && !isPast ? (
            <>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: SEMANTIC.success }} />
              <Txt size={12} weight="600" color={SEMANTIC.success}>
                Live from Transport NSW
              </Txt>
            </>
          ) : onTime && !isPast ? (
            <Txt size={12} color={c.textSecondary}>
              Scheduled timetable
            </Txt>
          ) : (
            <Txt size={12} color={c.textSecondary}>
              {isPast ? "Earlier trip" : "Real-time unavailable"}
            </Txt>
          )}
        </View>
      </View>
    </Pressable>
  );
}
