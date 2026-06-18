import { create } from "zustand";

export interface Coords {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coords: Coords | null;
  permissionStatus: "prompt" | "granted" | "denied" | "loading";
  showPromptModal: boolean;
  isAutoSavingAddress: boolean;
  hasAutoSavedAddress: boolean;
  setCoords: (coords: Coords | null) => void;
  setPermissionStatus: (status: "prompt" | "granted" | "denied" | "loading") => void;
  setShowPromptModal: (show: boolean) => void;
  setIsAutoSavingAddress: (saving: boolean) => void;
  setHasAutoSavedAddress: (done: boolean) => void;
  initLocation: () => Promise<void>;
  requestLocation: () => Promise<boolean>;
}

const STORAGE_KEY = "deligo_user_coords";

export const useLocationStore = create<LocationState>((set, get) => ({
  coords: null,
  permissionStatus: "loading",
  showPromptModal: false,
  isAutoSavingAddress: false,
  hasAutoSavedAddress: false,

  setCoords: (coords) => set({ coords }),
  setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
  setShowPromptModal: (showPromptModal) => set({ showPromptModal }),
  setIsAutoSavingAddress: (isAutoSavingAddress) => set({ isAutoSavingAddress }),
  setHasAutoSavedAddress: (hasAutoSavedAddress) => set({ hasAutoSavedAddress }),

  initLocation: async () => {
    if (typeof window === "undefined") return;

    // Load initial coords from cache if available, but do NOT short-circuit
    const cached = localStorage.getItem(STORAGE_KEY);
    let initialCoords: Coords | null = null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Coords;
        if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          initialCoords = parsed;
          set({ coords: parsed });
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    if (!navigator.geolocation) {
      set({ permissionStatus: "denied", coords: null, showPromptModal: false });
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: "geolocation" });

        const updatePermissionAndFetch = async (state: PermissionState) => {
          const mappedState = state as "prompt" | "granted" | "denied";
          set({ permissionStatus: mappedState });
          if (mappedState === "granted") {
            await get().requestLocation();
          } else if (mappedState === "prompt") {
            set({ showPromptModal: true });
          } else {
            localStorage.removeItem(STORAGE_KEY);
            set({ coords: null, showPromptModal: false });
          }
        };

        // Initialize state
        await updatePermissionAndFetch(permission.state);

        // Listen for change in permission status
        permission.onchange = async () => {
          await updatePermissionAndFetch(permission.state);
        };
      } else {
        // Fallback for browsers (like Safari) which don't support query permissions API
        if (initialCoords) {
          const success = await get().requestLocation();
          if (!success) {
            set({ showPromptModal: true, permissionStatus: "prompt" });
          }
        } else {
          set({ showPromptModal: true, permissionStatus: "prompt" });
        }
      }
    } catch (error) {
      console.error("Error checking geolocation permissions:", error);
      set({ showPromptModal: true, permissionStatus: "prompt" });
    }
  },

  requestLocation: async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      set({ permissionStatus: "denied", showPromptModal: false });
      return false;
    }

    set({ permissionStatus: "loading" });

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords: Coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newCoords));
          set({
            coords: newCoords,
            permissionStatus: "granted",
            showPromptModal: false,
          });
          resolve(true);
        },
        (error) => {
          console.error("Geolocation request failed:", error);
          localStorage.removeItem(STORAGE_KEY);
          set({
            coords: null,
            permissionStatus: "denied",
            showPromptModal: false,
          });
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  },
}));
