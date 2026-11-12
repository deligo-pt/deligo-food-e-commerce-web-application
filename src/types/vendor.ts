// Canonical vendor shape shared across the app. The cuisine field matches the
// real API, which returns restaurantCuisineType as an array of strings
// (occasionally a single string, sometimes absent). Typing it as a union here is
// what prevents the string-only assumptions that crashed search (see Issue.md #11).
import type { EstimatedDeliveryTime } from "@/lib/deliveryEstimate";
import type { Availability } from "@/lib/availability";
import type { WeeklyDaySchedule } from "@/lib/weeklySchedule";

export interface Vendor {
  _id?: string;
  id?: string;
  userId: string;
  /** `"SUB_VENDOR"` on a branch; not sent by every list. See `isBranchVendor`. */
  role?: string;
  businessDetails: {
    businessName: string;
    /** A branch's own name. Only the single-vendor routes send it (30 Sep 2026). */
    branchName?: string;
    businessType: string;
    restaurantCuisineType?: string[] | string;
    /** Legacy, read-only summary (guide §2). Display from `weeklySchedule` via `weekFrom()`. */
    openingHours: string;
    /** Legacy, read-only summary (guide §2). Display from `weeklySchedule` via `weekFrom()`. */
    closingHours: string;
    /** Per-weekday time slots (Nov 2026); the source of truth when present. See `lib/weeklySchedule.ts`. */
    weeklySchedule?: WeeklyDaySchedule[];
    /** Legacy open flag. Read `getAvailability()` instead, which prefers `availability`. */
    isStoreOpen: boolean;
    /**
     * Schedule + override state (Nov 2026). Drive every open/closed/paused
     * decision from this via `getAvailability()` in `lib/availability.ts`.
     */
    availability?: Availability;
    /** Legacy, read-only. Weekday names, e.g. `["Sunday"]` (sometimes `"sun_short"`). */
    closingDays?: string[];
    /** The store's IANA timezone, e.g. `"Europe/Lisbon"`. Not sent by every list. */
    timezone?: string;
  };
  businessLocation: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  storePhoto: string[];
  rating: {
    average: number;
    totalReviews: number;
  };
  /**
   * The backend's delivery estimate for the position the list was asked for.
   * Only `/vendors/nearby/open` sends it; `null` when it has none.
   */
  estimatedDeliveryTime?: EstimatedDeliveryTime | null;
  availableCategories?: {
    _id: string;
    name: string;
    icon: string;
  }[];
}
