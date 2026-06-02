import Navbar from "../components/shared/Navbar";
import Footer from "../components/shared/Footer";
import HomeContent from "../components/home/HomeContent";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d]">
      <Navbar />
      <HomeContent />
      <Footer />
    </div>
  );
}
