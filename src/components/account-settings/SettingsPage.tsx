"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Moon,
  Bell,
  MapPin,
  Languages,
  Clock3,
  UtensilsCrossed,
  ExternalLink,
  Trash2,
  Check,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";
import { useStore } from "@/stores/translationStore";
import { useSettingsStore } from "@/stores/settingsStore";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme, mounted } = useTheme();

  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore(
    (s) => s.setNotificationsEnabled,
  );
  const locationServicesEnabled = useSettingsStore(
    (s) => s.locationServicesEnabled,
  );
  const setLocationServicesEnabled = useSettingsStore(
    (s) => s.setLocationServicesEnabled,
  );

  const isDarkMode = mounted ? theme === "dark" : false;
  // Persisted preferences hydrate on the client; fall back to the store default
  // until mounted so the server/client markup matches (avoids hydration mismatch).
  const notificationsChecked = mounted ? notificationsEnabled : true;
  const locationServicesChecked = mounted ? locationServicesEnabled : true;

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
            {t("settings")}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t("settingsDescription")}
          </p>
        </div>

        <div className="space-y-8">
          {/* App Settings */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {t("appSettings")}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-colors duration-200">
              <ToggleRow
                icon={<Moon size={22} />}
                title={t("darkMode")}
                description={t("darkModeDescription")}
                checked={isDarkMode}
                onChange={() => setTheme(isDarkMode ? "light" : "dark")}
              />

              <ToggleRow
                icon={<Bell size={22} />}
                title={t("notifications")}
                description={t("notificationsDescription")}
                checked={notificationsChecked}
                onChange={() =>
                  setNotificationsEnabled(!notificationsChecked)
                }
              />

              <ToggleRow
                icon={<MapPin size={22} />}
                title={t("locationServices")}
                description={t("locationServicesDescription")}
                checked={locationServicesChecked}
                onChange={() =>
                  setLocationServicesEnabled(!locationServicesChecked)
                }
              />

              <LanguageRow />
            </div>
          </section>

          {/* Order Preferences */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {t("orderPreferences")}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-colors duration-200">
              <LinkRow
                icon={<Clock3 size={22} />}
                title={t("defaultDeliveryTime")}
                description={t("asap")}
                disabled
              />

              <LinkRow
                icon={<UtensilsCrossed size={22} />}
                title={t("dietaryPreferences")}
                description={t("noneSet")}
                disabled
                isLast
              />
            </div>
          </section>

          {/* Legal */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {t("legal")}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-colors duration-200">
              <ExternalRow title={t("termsOfService")} href="/terms" />
              <ExternalRow title={t("privacyPolicy")} href="/privacy" />

              <div className="flex items-center justify-between px-5 py-5">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {t("about")}
                </span>

                <span className="text-xs text-neutral-500 dark:text-neutral-400">Version 1.0.0</span>
              </div>
            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {t("account")}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm transition-colors duration-200">
              <button className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-red-50 dark:hover:bg-red-950/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40">
                  <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                </div>

                <div>
                  <p className="font-semibold text-red-600 dark:text-red-400">
                    {t("deleteAccount")}
                  </p>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t("deleteAccountDescription")}
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-5 py-5 last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="text-pink-600">{icon}</div>

        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
      </div>

      <button
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition cursor-pointer ${
          checked ? "bg-pink-600" : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? "left-[24px]" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function LinkRow({
  icon,
  title,
  description,
  isLast,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  // Target screen not built yet — render as clearly disabled (with a badge)
  // instead of a silently dead button, per the settings roadmap.
  if (disabled) {
    return (
      <div
        className={`flex w-full items-center justify-between px-5 py-5 opacity-60 ${
          !isLast ? "border-b border-neutral-100 dark:border-neutral-800" : ""
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="text-pink-600">{icon}</div>

          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
          </div>
        </div>

        <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {t("comingSoon")}
        </span>
      </div>
    );
  }

  return (
    <button
      className={`group flex w-full items-center justify-between px-5 py-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
        !isLast ? "border-b border-neutral-100 dark:border-neutral-800" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-pink-600">{icon}</div>

        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
      </div>

      <ChevronRight
        size={18}
        className="text-neutral-400 dark:text-neutral-500 transition group-hover:translate-x-1"
      />
    </button>
  );
}

// Endonyms so each language reads in its own name regardless of the active UI
// language — matches the EN/PT convention used by the navbar LanguageSwitcher.
const LANGUAGES: { code: "en" | "pt"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

function LanguageRow() {
  const { t } = useTranslation();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const [open, setOpen] = useState(false);

  const currentLabel =
    LANGUAGES.find((l) => l.code === lang)?.label ?? LANGUAGES[0].label;

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between px-5 py-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-pink-600">
            <Languages size={22} />
          </div>

          <div>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{t("language")}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{currentLabel}</p>
          </div>
        </div>

        <ChevronRight
          size={18}
          className={`text-neutral-400 dark:text-neutral-500 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/30">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between py-3.5 pl-16 pr-5 text-left text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors"
            >
              <span className={lang === l.code ? "font-semibold text-pink-600" : ""}>
                {l.label}
              </span>
              {lang === l.code && <Check size={16} className="text-pink-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExternalRow({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex w-full items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-5 py-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors last:border-b-0"
    >
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{title}</span>

      <ExternalLink size={18} className="text-neutral-400 dark:text-neutral-500" />
    </Link>
  );
}
