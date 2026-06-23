import { useEffect, useState } from "react";
import { useThemeStore } from "@/stores/themeStore";

export function useTheme() {
  const storeTheme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize the root element class list based on stored preference on mount
    const currentTheme = useThemeStore.getState().theme;
    const root = document.documentElement;
    if (currentTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, []);

  return {
    theme: mounted ? storeTheme : "light",
    setTheme,
    mounted,
  };
}
