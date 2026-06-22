"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

function CountryFlag({
  countryCode,
  name,
}: {
  countryCode: string;
  name: string;
}) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      alt={`${name} flag`}
      width={20}
      height={20}
      className="h-5 w-5 object-contain"
    />
  );
}

const availableCountry = {
  name: "Portugal",
  flagCode: "pt",
};

const upcomingCountries = [
  { name: "Spain", flagCode: "es" },
  { name: "United Kingdom", flagCode: "gb" },
  { name: "France", flagCode: "fr" },
  { name: "Netherlands", flagCode: "nl" },
  { name: "Germany", flagCode: "de" },
];

export default function SelectCountryPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#f7f7f7] dark:bg-neutral-950 px-4 py-10 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-neutral-50">{t("selectCountry")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
            {t("selectCountryDescription")}
          </p>
        </div>

        {/* Available */}
        <div className="mb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
            {t("availableCountries")}
          </p>

          <button className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 px-5 py-5 shadow-sm dark:shadow-none transition hover:shadow-md dark:hover:bg-neutral-800/30">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 dark:bg-neutral-950">
                <CountryFlag
                  countryCode={availableCountry.flagCode}
                  name={availableCountry.name}
                />
              </div>

              <span className="font-medium text-slate-900 dark:text-neutral-200">
                {availableCountry.name}
              </span>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400 dark:text-neutral-500" />
          </button>
        </div>

        {/* Upcoming */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
            {t("upcomingCountries")}
          </p>

          <div className="space-y-3">
            {upcomingCountries.map((country) => (
              <div
                key={country.name}
                className="flex items-center justify-between rounded-2xl bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 px-5 py-5 shadow-sm dark:shadow-none"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50 dark:bg-neutral-950">
                    <CountryFlag
                      countryCode={country.flagCode}
                      name={country.name}
                    />
                  </div>

                  <span className="font-medium text-slate-900 dark:text-neutral-200">
                    {country.name}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/30 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {t("upcoming")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
