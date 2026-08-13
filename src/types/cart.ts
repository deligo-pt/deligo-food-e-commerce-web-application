export interface CartAddon {
  // Localized to a string by the backend (Accept-Language); the bilingual
  // object shape is tolerated as a fallback.
  name: string | { en?: string; pt?: string };
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface CartItem {
  productId: string;
  name: string;
  image: string;
  variationSku: string | null;
  isActive: boolean;
  addons?: CartAddon[];

  // /carts/view-cart may return this populated as an object or as a bare id
  // string. Use getCartVendorId()/getCartVendorName() to read it safely.
  vendorId:
    | string
    | {
        _id?: string;
        id?: string;
        userId?: string;
        name?: {
          firstName: string;
          lastName: string;
        };
        /**
         * The store's own terms, as the cart reports them.
         *
         * Only the four fields observed on `/carts/view-cart` are declared. The
         * vendor list returns a great deal more on the same key —
         * `closingDays`, `isStoreOpen`, `businessLocation`, `restaurantCuisineType`
         * — and **none of it arrives here**. Declaring those would invite a
         * `?.` that silently reads `undefined` forever.
         *
         * `businessType` is typed loosely on purpose. It is `"RESTAURANT"` or
         * `"STORE"` today, and the pickup model decides how many days ahead a
         * vendor can be booked from it — but `fulfillmentType: null` on legacy
         * orders is the standing lesson that backend enums are not closed sets.
         * Everything unrecognised falls back to the most restrictive rule.
         */
        businessDetails?: {
          businessName?: string;
          openingHours?: string;
          closingHours?: string;
          businessType?: string;
        };
        /** The storefront photos, same key the vendor list uses. */
        documents?: {
          storePhoto?: string[];
        };
      };

  productPricing: {
    originalPrice: number;
    productDiscountAmount: number;
    // Prices are tax-inclusive; unitPrice/lineTotal are gross and taxAmount is
    // the embedded VAT. The cart endpoint no longer returns the pre-tax /
    // promo breakdown fields below, so they are optional.
    priceAfterProductDiscount?: number;
    promoDiscountAmount?: number;
    unitPrice: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  };

  itemSummary: {
    quantity: number;
    totalTaxAmount: number;
    totalProductDiscount: number;
    grandTotal: number;
    totalBeforeTax?: number;
    totalPromoDiscount?: number;
  };
}

export interface CartResponse {
  _id: string;
  customerId: string;
  items: CartItem[];
  totalItems: number;

  cartCalculation: {
    totalOriginalPrice: number;
    totalProductDiscount: number;
    totalTaxAmount: number;
    grandTotal: number;
    taxableAmount?: number;
  };
}