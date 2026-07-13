import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useStore } from "@/stores/translationStore";
// `pt` is the default + fallback language, so it's bundled synchronously (the
// server always renders `pt`, and so does the client's first paint — no
// hydration mismatch). Every OTHER language is code-split and loaded on demand,
// keeping ~half of the ~3,000 dictionary lines out of the initial bundle.
import pt from "@/assets/translations/pt";

type Language = "en" | "pt";
type Dict = Record<string, unknown>;

const fallbackDict = pt as unknown as Dict;

// Dictionaries available synchronously (bundled) or already lazily loaded.
const loadedDicts: Record<string, Dict> = { pt: fallbackDict };
// Loaders for the code-split languages (each becomes its own async chunk).
const dictLoaders: Record<string, () => Promise<Dict>> = {
  en: () =>
    import("@/assets/translations/en").then((m) => m.default as unknown as Dict),
};

// Minimal external store: bump a version when a lazy dictionary finishes
// loading so any mounted `useTranslation` consumer re-renders with the new
// strings. `version` only changes on a real dictionary load (never per render),
// so `t`'s identity stays stable — the property that prevents the effect-driven
// refetch/429 loops.
let version = 0;
const listeners = new Set<() => void>();
const loadingLangs = new Set<string>();

function ensureDict(lang: string) {
  if (loadedDicts[lang] || loadingLangs.has(lang)) return;
  const loader = dictLoaders[lang];
  if (!loader) return;
  loadingLangs.add(lang);
  loader()
    .then((dict) => {
      loadedDicts[lang] = dict;
      loadingLangs.delete(lang);
      version += 1;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      loadingLangs.delete(lang);
    });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return version;
}

export const useTranslation = () => {
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);
  // Changes on every language switch (see translationStore).
  const langVersion = useStore((state) => state.langVersion);

  // Re-render when a lazily-loaded dictionary becomes available. `getSnapshot`
  // is used for the server value too — on the server only `pt` exists, matching
  // the client's first paint.
  const dictVersion = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Kick off loading the active dictionary if it isn't bundled/loaded yet.
  useEffect(() => {
    ensureDict(lang);
  }, [lang]);

  // Memoized on `lang` + `dictVersion` so its identity is stable across renders
  // and only changes when the language switches or a lazy dictionary lands.
  // Falls back to `pt` (always bundled) while another language is still loading.
  const t = useCallback(
    (key: string): string => {
      const dict = loadedDicts[lang];
      const value = dict?.[key] ?? fallbackDict[key] ?? key;
      return typeof value === "string" ? value : key;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, dictVersion],
  );

  const i18n = useMemo(
    () => ({
      language: lang,
      changeLanguage: (newLang: Language) => setLang(newLang),
    }),
    [lang, setLang],
  );

  return {
    t,
    i18n,
    langVersion,
  };
};
