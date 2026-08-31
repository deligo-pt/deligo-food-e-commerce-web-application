"use client";

import HeroSection from "./HeroSection";
import CategoriesSection from "./CategoriesSection";
import RestaurantsSection from "./RestaurantsSection";
import ShopSection from "./ShopSection";
import { useTranslation } from "@/hooks/useTranslation";

export default function HomeContent() {
  const { t } = useTranslation();

  // Phase 7 #4. Section-to-section was 40/64; §1.2 says 48/64, and 40 was
  // never on the scale. The prototype uses 80, which is outside the system —
  // the scale wins over the reference.
  return (
    <main className="w-full space-y-12 px-4 pb-16 pt-0 sm:space-y-16 sm:pb-24 lg:px-16">
      {/*
        Plan.md Phase 5 #4. The homepage had no <h1> in its normal case: the
        only one lived inside the hero's empty state, so once the banners
        loaded the document started at <h2> and a screen reader had no name for
        the page.

        It is `sr-only` because there is nothing to show — the top of this page
        is a carousel of sponsor artwork, and a visible title above it would be
        a design change, not a bug fix. The wording is the app's own <title>,
        not new copy.
      */}
      <h1 className="sr-only">{t("homeHeading")}</h1>
      <HeroSection />
      <ShopSection />
      <CategoriesSection />
      <RestaurantsSection />
    </main>
  );
}