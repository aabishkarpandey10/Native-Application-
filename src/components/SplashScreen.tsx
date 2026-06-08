import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Text, View } from "react-native";
import { APP_CONFIG_DEFAULTS } from "../types/appConfig";
import { AppLogo } from "../components/branding/AppLogo";
import { useAppConfig } from "../hooks/useAppConfig";

interface SplashScreenProps {
  visible: boolean;
}

const useNativeDriver = Platform.OS !== "web";

export function SplashScreen({ visible }: SplashScreenProps) {
  const { data: appConfig } = useAppConfig();
  const appName = appConfig?.appName ?? APP_CONFIG_DEFAULTS.appName;
  const tagline = appConfig?.tagline ?? APP_CONFIG_DEFAULTS.tagline;

  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: useNativeDriver ? 280 : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, opacity, scale]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={{
        opacity,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "#0A0A0C",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <AppLogo size={104} config={appConfig ?? APP_CONFIG_DEFAULTS} />
      </Animated.View>

      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: "700",
          marginTop: 24,
          letterSpacing: -0.5,
        }}
      >
        {appName}
      </Text>
      <Text style={{ color: "#0A84FF", fontSize: 14, fontWeight: "600", marginTop: 6 }}>
        {tagline}
      </Text>
    </Animated.View>
  );
}
