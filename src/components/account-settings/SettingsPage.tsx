"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTheme } from "@/hooks/useTheme";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme, mounted } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);

  const isDarkMode = mounted ? theme === "dark" : false;

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
                checked={notifications}
                onChange={() => setNotifications(!notifications)}
              />

              <ToggleRow
                icon={<MapPin size={22} />}
                title={t("locationServices")}
                description={t("locationServicesDescription")}
                checked={locationServices}
                onChange={() => setLocationServices(!locationServices)}
              />

              <LinkRow
                icon={<Languages size={22} />}
                title={t("language")}
                description="English"
              />
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
              />

              <LinkRow
                icon={<UtensilsCrossed size={22} />}
                title={t("dietaryPreferences")}
                description={t("noneSet")}
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
              <ExternalRow title={t("termsOfService")} />
              <ExternalRow title={t("privacyPolicy")} />

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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
}) {
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

function ExternalRow({ title }: { title: string }) {
  return (
    <button className="flex w-full items-center justify-between border-b border-neutral-100 dark:border-neutral-800 px-5 py-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors last:border-b-0">
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{title}</span>

      <ExternalLink size={18} className="text-neutral-400 dark:text-neutral-500" />
    </button>
  );
}
