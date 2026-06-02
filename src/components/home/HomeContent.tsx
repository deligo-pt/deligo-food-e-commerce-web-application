import HeroSection from "./HeroSection";
import CategoriesSection from "./CategoriesSection";
import RestaurantsSection from "./RestaurantsSection";
import ShopSection from "./ShopSection";

export default function HomeContent() {
  return (
    <main className="w-full space-y-16 px-4 pb-24 pt-0 lg:px-16">
      <HeroSection />
      <ShopSection />
      <CategoriesSection />
      <RestaurantsSection />
    </main>
  );
}