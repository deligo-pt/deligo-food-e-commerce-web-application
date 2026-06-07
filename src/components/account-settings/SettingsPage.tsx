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

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-neutral-900">Settings</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Manage your app experience, account details, and preferences.
          </p>
        </div>

        <div className="space-y-8">
          {/* App Settings */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900">
              App Settings
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <ToggleRow
                icon={<Moon size={22} />}
                title="Dark Mode"
                description="Adjust app appearance"
                checked={darkMode}
                onChange={() => setDarkMode(!darkMode)}
              />

              <ToggleRow
                icon={<Bell size={22} />}
                title="Notifications"
                description="Enable order updates and promos"
                checked={notifications}
                onChange={() => setNotifications(!notifications)}
              />

              <ToggleRow
                icon={<MapPin size={22} />}
                title="Location Services"
                description="For faster delivery address detection"
                checked={locationServices}
                onChange={() => setLocationServices(!locationServices)}
              />

              <LinkRow
                icon={<Languages size={22} />}
                title="Language"
                description="English"
              />
            </div>
          </section>

          {/* Order Preferences */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900">
              Order Preferences
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <LinkRow
                icon={<Clock3 size={22} />}
                title="Default Delivery Time"
                description="ASAP"
              />

              <LinkRow
                icon={<UtensilsCrossed size={22} />}
                title="Dietary Preferences"
                description="None set"
                isLast
              />
            </div>
          </section>

          {/* Legal */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900">
              Legal
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <ExternalRow title="Terms of Service" />
              <ExternalRow title="Privacy Policy" />

              <div className="flex items-center justify-between px-5 py-5">
                <span className="font-medium text-neutral-900">About</span>

                <span className="text-xs text-neutral-500">Version 1.0.0</span>
              </div>
            </div>
          </section>

          {/* Account */}
          <section>
            <h2 className="mb-4 px-1 text-lg font-semibold text-neutral-900">
              Account
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <button className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-red-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Trash2 size={18} className="text-red-600" />
                </div>

                <div>
                  <p className="font-semibold text-red-600">Delete Account</p>

                  <p className="text-xs text-neutral-500">
                    Permanently delete your account
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
    <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-5 last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="text-pink-600">{icon}</div>

        <div>
          <p className="font-medium text-neutral-900">{title}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>

      <button
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-pink-600" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "right-1" : "left-1"
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
      className={`group flex w-full items-center justify-between px-5 py-5 text-left hover:bg-neutral-50 ${
        !isLast ? "border-t border-neutral-100" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-pink-600">{icon}</div>

        <div>
          <p className="font-medium text-neutral-900">{title}</p>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>

      <ChevronRight
        size={18}
        className="text-neutral-400 transition group-hover:translate-x-1"
      />
    </button>
  );
}

function ExternalRow({ title }: { title: string }) {
  return (
    <button className="flex w-full items-center justify-between border-b border-neutral-100 px-5 py-5 text-left hover:bg-neutral-50 last:border-b-0">
      <span className="font-medium text-neutral-900">{title}</span>

      <ExternalLink size={18} className="text-neutral-400" />
    </button>
  );
}
