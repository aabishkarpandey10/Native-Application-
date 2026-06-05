import { useEffect, useMemo } from "react";
import { Animated, Text, View } from "react-native";
import { Bot } from "lucide-react-native";

export function TypingIndicator({ label = "Thinking" }: { label?: string }) {
  const d1 = useMemo(() => new Animated.Value(0.3), []);
  const d2 = useMemo(() => new Animated.Value(0.3), []);
  const d3 = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
        ])
      );

    const a1 = pulse(d1, 0);
    const a2 = pulse(d2, 120);
    const a3 = pulse(d3, 240);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [d1, d2, d3]);

  return (
    <View className="flex-row mb-4">
      <View className="w-8 h-8 bg-surface-card rounded-full items-center justify-center mr-2 border border-surface-border">
        <Bot size={16} color="#71717A" />
      </View>
      <View className="bg-surface-card border border-surface-border rounded-2xl rounded-tl-md px-4 py-3.5 min-w-[120px]">
        <Text className="text-zinc-500 text-xs mb-2">{label}</Text>
        <View className="flex-row items-center gap-1.5">
          {[d1, d2, d3].map((dot, i) => (
            <Animated.View
              key={i}
              style={{ opacity: dot }}
              className="w-2 h-2 rounded-full bg-brand-primary"
            />
          ))}
        </View>
      </View>
    </View>
  );
}
