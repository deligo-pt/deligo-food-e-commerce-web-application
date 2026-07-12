import HeroSection from "./HeroSection";
import CategoriesSection from "./CategoriesSection";
import RestaurantsSection from "./RestaurantsSection";
import ShopSection from "./ShopSection";

export default function HomeContent() {
  return (
    <main className="w-full space-y-10 px-4 pb-16 pt-0 sm:space-y-16 sm:pb-24 lg:px-16">
      <HeroSection />
      <ShopSection />
      <CategoriesSection />
      <RestaurantsSection />
    </main>
  );
}