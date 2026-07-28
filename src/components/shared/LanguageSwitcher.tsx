"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { useStore } from "@/stores/translationStore";

// Hydration-safe "is the client mounted yet" flag. Returns false on the server
// and during the first hydration render, then true — without a setState-in-effect
// (which triggers cascading renders). Lets us defer to the persisted store value
// only after hydration so the label matches the real saved language.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export default function LanguageSwitcher() {
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mark the language change as a non-urgent transition so React keeps the
  // current (old-language) UI painted and interactive while components re-fetch
  // in the background, instead of dropping straight to loading states.
  const [, startLangTransition] = useTransition();

  const changeLanguage = (nextLang: "en" | "pt") => {
    startLangTransition(() => {
      setLang(nextLang);
    });
    setOpen(false);
  };

  // The language lives in a persisted (localStorage) store, so the server
  // renders the default while the client rehydrates to the real saved value.
  // Only show the store value after hydration so the label always matches the
  // active language instead of getting stuck on the server-rendered default.
  const mounted = useHydrated();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        suppressHydrationWarning
        aria-label="Change language"
        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm"
      >
        {mounted ? lang.toUpperCase() : "PT"}
        <ChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-24 overflow-hidden rounded-xl bg-white shadow-lg">
          <button
            onClick={() => changeLanguage("en")}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-black hover:bg-gray-100"
          >
            EN
            {lang === "en" && <Check size={16} />}
          </button>

          <button
            onClick={() => changeLanguage("pt")}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-black hover:bg-gray-100"
          >
            PT
            {lang === "pt" && <Check size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}