"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";

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
  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-10">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Select Country
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Choose your location to start ordering the best food near you.
          </p>
        </div>

        {/* Available */}
        <div className="mb-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Available Countries
          </p>

          <button className="flex w-full items-center justify-between rounded-2xl bg-white px-5 py-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50">
                <CountryFlag
                  countryCode={availableCountry.flagCode}
                  name={availableCountry.name}
                />
              </div>

              <span className="font-medium text-slate-900">
                {availableCountry.name}
              </span>
            </div>

            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Upcoming */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Upcoming Countries
          </p>

          <div className="space-y-3">
            {upcomingCountries.map((country) => (
              <div
                key={country.name}
                className="flex items-center justify-between rounded-2xl bg-white px-5 py-5 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-50">
                    <CountryFlag
                      countryCode={country.flagCode}
                      name={country.name}
                    />
                  </div>

                  <span className="font-medium text-slate-900">
                    {country.name}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Upcoming
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}