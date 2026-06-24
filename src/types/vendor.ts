// Canonical vendor shape shared across the app. The cuisine field matches the
// real API, which returns restaurantCuisineType as an array of strings
// (occasionally a single string, sometimes absent). Typing it as a union here is
// what prevents the string-only assumptions that crashed search (see Issue.md #11).
export interface Vendor {
  _id?: string;
  id?: string;
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    restaurantCuisineType?: string[] | string;
    openingHours: string;
    closingHours: string;
    isStoreOpen: boolean;
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
  availableCategories?: {
    _id: string;
    name: string;
    icon: string;
  }[];
}
