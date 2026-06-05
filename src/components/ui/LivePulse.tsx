import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface LivePulseProps {
  color?: string;
  size?: number;
}

export function LivePulse({ color = "#30D158", size = 6 }: LivePulseProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
    scale.value = withRepeat(
      withSequence(withTiming(1.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1
    );
  }, [opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.5,
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          ringStyle,
          {
            position: "absolute",
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: color,
          },
        ]}
      />
      <Animated.View
        style={[
          dotStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}
