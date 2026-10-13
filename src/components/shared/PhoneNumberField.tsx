"use client";

import Image from "next/image";
import { Check, ChevronDown, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COUNTRY_OPTIONS, type CountryOption } from "@/data/countryCodes";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * A phone number with its country: flag and dial code in a menu, the national
 * number beside it (13 Oct 2026). The same look and menu as the login page's
 * Mobile tab.
 *
 * It takes and gives back the **full** number (`+351920393687`), so a form
 * that already stores, compares and validates full numbers keeps doing so —
 * the split into country and national part is for display only.
 *
 * - The country is the longest dial code the value starts with; anything else
 *   (an empty value, an old number saved without `+`) shows the first country,
 *   Portugal, with the value as the national part.
 * - An empty box gives `""`, never a bare dial code.
 * - Typing a whole number with `+` in the box (a paste) is passed through as
 *   is, and the country follows it.
 */

/** The country a full number belongs to, and the rest of it. */
export function splitPhoneNumber(value: string): { country: CountryOption; national: string } {
  const trimmed = (value ?? "").trim();
  const byLength = [...COUNTRY_OPTIONS].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const match = trimmed.startsWith("+") ? byLength.find((c) => trimmed.startsWith(c.dialCode)) : undefined;
  if (match) return { country: match, national: trimmed.slice(match.dialCode.length).trimStart() };
  return { country: COUNTRY_OPTIONS[0], national: trimmed };
}

function CountryFlag({ country }: { country: CountryOption }) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${country.flagCode}.png`}
      alt={`${country.name} flag`}
      width={20}
      height={20}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

type Props = {
  /** The full number, dial code included. */
  value: string;
  onChange: (fullNumber: string) => void;
  id?: string;
  disabled?: boolean;
  /** Outline when the field is wrong. */
  invalid?: boolean;
};

export default function PhoneNumberField({ value, onChange, id, disabled = false, invalid = false }: Props) {
  const { t } = useTranslation();
  const split = splitPhoneNumber(value);
  // An empty number is `""`, not a bare dial code (so clearing the box is not
  // a change); the country picked for it is kept here until digits arrive.
  const [pickedCountry, setPickedCountry] = useState<CountryOption | null>(null);
  const country = split.national ? split.country : (pickedCountry ?? split.country);
  const national = split.national;
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(menuOpen, () => setMenuOpen(false));
  // A click anywhere else closes the menu.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const setNational = (typed: string) => {
    // A pasted full number brings its own country.
    if (typed.trim().startsWith("+")) onChange(typed.trim());
    else onChange(typed.trim() ? `${country.dialCode}${typed}` : "");
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div
        className={`flex items-center gap-3 rounded border bg-card px-4 py-3 transition-colors focus-within:border-primary dark:focus-within:border-pink-500 ${
          invalid ? "border-red-400 dark:border-red-500" : "border-border"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          aria-label={t("selectCountryCode")}
          onClick={() => setMenuOpen((open) => !open)}
          className="focus-ring flex shrink-0 items-center gap-2 rounded-sm text-base font-medium text-foreground transition-colors hover:text-primary dark:text-neutral-300 dark:hover:text-pink-400"
        >
          <CountryFlag country={country} />
          <span>{country.dialCode}</span>
          <ChevronDown size={16} strokeWidth={2.6} className="text-muted-foreground dark:text-neutral-500" />
        </button>
        <div className="h-6 w-px shrink-0 bg-[#dedede] dark:bg-neutral-800" />
        <Phone size={18} className="hidden shrink-0 text-muted-foreground sm:block dark:text-neutral-500" />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          onChange={(event) => setNational(event.target.value)}
          placeholder={t("mobileNumber")}
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-muted-foreground dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
      </div>

      {menuOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-20 mt-2 w-full max-w-80 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_rgba(16,24,40,0.18)] dark:shadow-none"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#a0a0a0] dark:text-neutral-500">
              {t("selectCountryCode")}
            </p>
            <p className="mt-1 text-base text-[#5d5d5d] dark:text-neutral-400">{t("chooseCountryAndDialCode")}</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {COUNTRY_OPTIONS.map((option) => {
              const selected = option.dialCode === country.dialCode && option.name === country.name;
              return (
                <button
                  key={`${option.name}-${option.dialCode}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setPickedCountry(option);
                    if (national) onChange(`${option.dialCode}${national}`);
                    setMenuOpen(false);
                  }}
                  className={`focus-ring flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${
                    selected
                      ? "bg-[#fff4f8] text-primary dark:bg-pink-950/20 dark:text-pink-400"
                      : "text-foreground hover:bg-[#fafafa] dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <CountryFlag country={option} />
                    <span className="flex flex-col">
                      <span className="text-base font-medium">{option.name}</span>
                      <span className="text-xs text-muted-foreground dark:text-neutral-500">{option.dialCode}</span>
                    </span>
                  </span>
                  {selected ? <Check size={18} className="text-primary dark:text-pink-400" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
