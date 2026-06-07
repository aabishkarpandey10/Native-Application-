import { CheckCircle2, Info } from "lucide-react-native";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SEMANTIC, SPACING } from "../constants/design";
import { getToastBottomOffset } from "../constants/layout";
import { useColors } from "../hooks/useColors";
import { Txt } from "../components/design/Txt";

type ToastType = "success" | "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

interface ToastProviderProps {
  children: ReactNode;
  /** When false (stack screens), toast sits above home indicator only. */
  aboveTabBar?: boolean;
}

export function ToastProvider({ children, aboveTabBar }: ToastProviderProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const onTabScreen = segments[0] === "(tabs)";
  const toastBottom = getToastBottomOffset(insets.bottom, aboveTabBar ?? onTabScreen);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    setToast({ id: idRef.current, message, type });
    timerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const toastStyle = useMemo(() => {
    switch (toast?.type) {
      case "success":
        return {
          bg: c.isDark ? "#1A2E22" : "#ECFDF3",
          border: c.isDark ? "#166534" : "#BBF7D0",
          icon: SEMANTIC.success,
        };
      case "error":
        return {
          bg: c.isDark ? "#3B1F1F" : "#FEF2F2",
          border: c.isDark ? "#7F1D1D" : "#FECACA",
          icon: SEMANTIC.destructive,
        };
      default:
        return {
          bg: c.isDark ? "#1F2238" : "#EEF2FF",
          border: c.isDark ? "#3730A3" : "#C7D2FE",
          icon: c.primary,
        };
    }
  }, [c.isDark, c.primary, toast?.type]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: toastBottom,
            left: SPACING.screen,
            right: SPACING.screen,
            zIndex: 99999,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: RADIUS.card,
              borderWidth: 1,
              backgroundColor: toastStyle.bg,
              borderColor: toastStyle.border,
              width: "100%",
            }}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} color={toastStyle.icon} />
            ) : (
              <Info size={16} color={toastStyle.icon} />
            )}
            <Txt size={14} weight="500" color={c.text} style={{ flex: 1 }} numberOfLines={2}>
              {toast.message}
            </Txt>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
