"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useStore } from "@/stores/translationStore";

export default function LanguageSwitcher() {
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/20 sm:gap-2 sm:px-3"
      >
        {lang.toUpperCase()}
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-24 overflow-hidden rounded-xl bg-white shadow-lg">
          <button
            onClick={() => {
              setLang("en");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-black hover:bg-gray-100"
          >
            EN
            {lang === "en" && <Check size={16} />}
          </button>

          <button
            onClick={() => {
              setLang("pt");
              setOpen(false);
            }}
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