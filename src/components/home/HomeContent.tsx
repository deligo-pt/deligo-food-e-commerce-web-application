import HeroSection from "./HeroSection";
import CategoriesSection from "./CategoriesSection";
import RestaurantsSection from "./RestaurantsSection";
import ShopSection from "./ShopSection";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";


export default async function HomeContent() {
    const cookieStore = await cookies();

  const token = cookieStore.get("deligo-access-token");

  if (!token) {
    redirect("/login");
  }
  return (
    <main className="w-full space-y-16 px-4 pb-24 pt-0 lg:px-16">
      <HeroSection />
      <ShopSection />
      <CategoriesSection />
      <RestaurantsSection />
    </main>
  );
}