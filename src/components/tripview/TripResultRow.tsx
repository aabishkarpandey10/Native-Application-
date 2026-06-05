import { Pressable, View } from "react-native";
import { Users } from "lucide-react-native";
import { SEMANTIC } from "../../constants/design";
import { useColors } from "../../hooks/useColors";
import { Txt } from "../design/Txt";
import { TRIPVIEW_BLUE } from "../../utils/tripDisplay";
import { formatLeaveIn, shortStationName } from "../../utils/tripViewFormat";

export interface TripResultRowProps {
  leaveInMinutes: number;
  originName: string;
  destName: string;
  originPlatform?: string;
  departClock: string;
  arriveClock: string;
  routeCode: string;
  accentColor?: string;
  onTime?: boolean;
  realtime?: boolean;
  isPast?: boolean;
  onPress?: () => void;
}

export function TripResultRow({
  leaveInMinutes,
  originName,
  destName,
  originPlatform,
  departClock,
  arriveClock,
  routeCode,
  accentColor = TRIPVIEW_BLUE,
  onTime = true,
  realtime = true,
  isPast = false,
  onPress,
}: TripResultRowProps) {
  const c = useColors();
  const leaveLabel = formatLeaveIn(leaveInMinutes);
  const sidebarColor = isPast ? c.separator : accentColor;
  const timeColor = isPast ? c.textSecondary : c.text;
  const routeColor = isPast ? c.textSecondary : accentColor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        minHeight: 88,
        opacity: pressed ? 0.85 : isPast ? 0.72 : 1,
        borderBottomWidth: 0.5,
        borderBottomColor: c.separator,
      })}
    >
      <View
        style={{
          width: 76,
          backgroundColor: sidebarColor,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
        }}
      >
        <Txt size={15} weight="700" color={isPast ? c.text : "#FFFFFF"} style={{ textAlign: "center" }}>
          {leaveLabel}
        </Txt>
      </View>

      <View style={{ flex: 1, backgroundColor: c.bg, paddingVertical: 10, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Txt size={12} color={c.textSecondary} numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
            {shortStationName(originName)}
            {originPlatform ? ` Platform ${originPlatform}` : ""}
          </Txt>
          <Txt size={12} color={c.textSecondary} numberOfLines={1}>
            {shortStationName(destName)}
          </Txt>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt size={22} weight="700" color={timeColor}>
            {departClock}
          </Txt>
          <Txt size={22} weight="700" color={timeColor}>
            {arriveClock}
          </Txt>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {onTime && realtime ? (
              <>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: SEMANTIC.success }} />
                <Txt size={13} weight="600" color={SEMANTIC.success}>
                  Live · on time
                </Txt>
              </>
            ) : onTime && !isPast ? (
              <Txt size={12} color={c.textSecondary}>
                Scheduled timetable
              </Txt>
            ) : (
              <Txt size={12} color={c.textSecondary}>
                Real-time data unavailable
              </Txt>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "52%" }}>
            <Users size={14} color={routeColor} strokeWidth={2} />
            <Txt size={14} weight="600" color={routeColor} numberOfLines={2} style={{ textAlign: "right" }}>
              {routeCode}
            </Txt>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
