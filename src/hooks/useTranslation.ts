import translations from "@/assets/translations";
import { useStore } from "@/stores/translationStore";

type Language = keyof typeof translations;

export const useTranslation = () => {
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);
  // Changes on every language switch. Add this to a fetch effect's dependency
  // array to make server-localized data re-fetch on a language change without a
  // remount. See LanguageBoundary for why the remount was removed.
  const langVersion = useStore((state) => state.langVersion);

  const t = (key: string): string => {
    const dict = (translations[lang] as unknown) as Record<string, unknown> | undefined;
    const fallbackDict = (translations.en as unknown) as Record<string, unknown>;
    const value = dict?.[key] ?? fallbackDict[key] ?? key;
    return typeof value === "string" ? value : key;
  };

  const i18n = {
    language: lang,
    changeLanguage: (newLang: Language) => setLang(newLang),
  };

  return {
    t,
    i18n,
    langVersion,
  };
};
