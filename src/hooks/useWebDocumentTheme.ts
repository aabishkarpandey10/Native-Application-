import { useEffect } from "react";
import { Platform } from "react-native";
import { useColors } from "./useColors";

/** Keeps browser chrome (html/body) in sync with the app palette on web. */
export function useWebDocumentTheme() {
  const c = useColors();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const root = document.documentElement;
    root.style.backgroundColor = c.bg;
    root.setAttribute("data-theme", c.isDark ? "dark" : "light");
    document.body.style.backgroundColor = c.bg;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", c.bg);
  }, [c.bg, c.isDark]);
}
