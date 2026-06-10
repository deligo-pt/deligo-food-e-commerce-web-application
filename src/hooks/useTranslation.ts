import translations from "@/assets/translations";
import { useStore } from "@/stores/translationStore";

type Language = keyof typeof translations;

export const useTranslation = () => {
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);

  const t = (key: string): string => {
    return (
      translations[lang]?.[key as keyof (typeof translations)["en"]] ||
      translations.en[key as keyof (typeof translations)["en"]] ||
      key
    );
  };

  const i18n = {
    language: lang,
    changeLanguage: (newLang: Language) => setLang(newLang),
  };

  return {
    t,
    i18n,
  };
};
