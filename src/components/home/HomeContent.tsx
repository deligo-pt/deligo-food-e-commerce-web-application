"use client";

import HeroSection from "./HeroSection";
import CategoriesSection from "./CategoriesSection";
import RestaurantsSection from "./RestaurantsSection";
import ShopSection from "./ShopSection";
import { useTranslation } from "@/hooks/useTranslation";

export default function HomeContent() {
  const { t } = useTranslation();

  // Phase 7 #4 set section-to-section at §1.2's 48/64, against the prototype's
  // 80. Browser round 5 steps it down again, to 32/48.
  //
  // The measurement that moved it: reported from a screenshot as "a lot of
  // gap", and the rhythm was only ever half of it. A band's bottom to the next
  // band's *content* ran 64 + accent + 12 + heading + 24 ≈ 144, of which the
  // section gap is the part anyone counts and the heading block is the part
  // nobody does. Both come down — see `SectionHeading`, whose 24 to its own
  // content is now 16.
  //
  // This is the one place the rhythm is stated. A band that carries its own
  // clearance overrides it and lands back on it; §18 asserts that relationship
  // rather than either number.
  return (
    <main className="w-full space-y-8 px-4 pb-16 pt-0 sm:space-y-12 sm:pb-16 lg:px-16">
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