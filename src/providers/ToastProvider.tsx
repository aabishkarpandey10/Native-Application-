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
import { Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getToastBottomOffset } from "../constants/layout";

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

export function ToastProvider({ children, aboveTabBar = true }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const toastBottom = getToastBottomOffset(insets.bottom, aboveTabBar);
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

  const colors = {
    success: { bg: "bg-brand-secondary/15", border: "border-brand-secondary/35", icon: "#30D158" },
    info: { bg: "bg-brand-primary/15", border: "border-brand-primary/35", icon: "#0A84FF" },
    error: { bg: "bg-red-500/15", border: "border-red-500/35", icon: "#FF453A" },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: toastBottom,
            left: Platform.OS === "android" ? 12 : 16,
            right: Platform.OS === "android" ? 12 : 16,
            zIndex: 99999,
            alignItems: "center",
          }}
        >
          <View
            className={`flex-row items-center gap-2.5 px-4 py-3 rounded-xl border ${colors[toast.type].bg} ${colors[toast.type].border}`}
            style={{ maxWidth: 400, width: "100%" }}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} color={colors.success.icon} />
            ) : (
              <Info size={16} color={colors[toast.type].icon} />
            )}
            <Text className="text-white text-sm font-medium flex-1" numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}
