import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import LocationPromptModal from "@/components/shared/LocationPromptModal";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <LocationPromptModal />

      <main className="flex-1">{children}</main>

      <Footer />
    </>
  );
}
