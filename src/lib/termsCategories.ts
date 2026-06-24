// Single source of truth for the Terms category pages. Both the /terms index
// (card grid) and the /terms/[category] dynamic route read from this list, so the
// slugs, icons, and translation keys can never drift apart.
export type TermsCategory = {
  slug: string;
  icon: string;
  titleKey: string;
  bodyKey: string;
};

export const TERMS_CATEGORIES: TermsCategory[] = [
  { slug: "rides", icon: "🚗", titleKey: "categoryRides", bodyKey: "termsCatRidesBody" },
  {
    slug: "micromobility",
    icon: "🛴",
    titleKey: "categoryMicromobility",
    bodyKey: "termsCatMicromobilityBody",
  },
  { slug: "drive", icon: "🚕", titleKey: "categoryDeliGoDrive", bodyKey: "termsCatDriveBody" },
  { slug: "delivery", icon: "🍔", titleKey: "categoryDelivery", bodyKey: "termsCatDeliveryBody" },
  { slug: "insurance", icon: "🛡️", titleKey: "categoryInsurance", bodyKey: "termsCatInsuranceBody" },
  {
    slug: "business",
    icon: "💼",
    titleKey: "categoryDeliGoBusiness",
    bodyKey: "termsCatBusinessBody",
  },
  { slug: "vendors", icon: "🏪", titleKey: "categoryVendors", bodyKey: "termsCatVendorsBody" },
  { slug: "other", icon: "📄", titleKey: "categoryOther", bodyKey: "termsCatOtherBody" },
];

export const getTermsCategory = (slug: string): TermsCategory | undefined =>
  TERMS_CATEGORIES.find((category) => category.slug === slug);
