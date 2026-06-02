import Navbar from "../../components/shared/Navbar";
import Footer from "../../components/shared/Footer";
import CategoriesPage from "../../components/categories/CategoriesPage";

export default function CategoriesRoute() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d]">
      <Navbar />
      <CategoriesPage />
      <Footer />
    </div>
  );
}