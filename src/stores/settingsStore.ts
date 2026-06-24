import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  notificationsEnabled: boolean;
  locationServicesEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  setLocationServicesEnabled: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notificationsEnabled: true,
      locationServicesEnabled: true,
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setLocationServicesEnabled: (value) =>
        set({ locationServicesEnabled: value }),
    }),
    {
      name: "app-settings",
      storage: {
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          const value = localStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          if (typeof window !== "undefined") {
            localStorage.setItem(name, JSON.stringify(value));
          }
        },
        removeItem: (name) => {
          if (typeof window !== "undefined") {
            localStorage.removeItem(name);
          }
        },
      },
    },
  ),
);
