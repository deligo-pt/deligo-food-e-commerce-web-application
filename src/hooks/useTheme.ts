import { useEffect, useSyncExternalStore } from "react";
import { useThemeStore } from "@/stores/themeStore";

const emptySubscribe = () => () => {};

export function useTheme() {
  const storeTheme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  // Hydration-safe mount flag (no setState-in-effect): the server snapshot is
  // `false` and the client snapshot is `true`, so SSR and the first client
  // render agree ("light") and only then switch to the stored theme.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    // Initialize the root element class list based on stored preference on mount.
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
