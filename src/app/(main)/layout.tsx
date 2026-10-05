import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import LocationPromptModalLazy from "@/components/shared/LocationPromptModalLazy";
import SupportChatDialogLazy from "@/components/support/SupportChatDialogLazy";
import LanguageBoundary from "@/components/shared/LanguageBoundary";
import PageBackBar from "@/components/shared/PageBackBar";
import OrderRatingPromptLazy from "@/components/orders/OrderRatingPromptLazy";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <LocationPromptModalLazy />
      {/* Mounted once here so any page can open it through `supportChatStore`
          without the panel unmounting on navigation mid-conversation. */}
      <SupportChatDialogLazy />
      {/* Asks for feedback right after an order completes, on whatever page
          the customer is on. */}
      <OrderRatingPromptLazy />

      <main className="flex-1">
        <PageBackBar />
        <LanguageBoundary>{children}</LanguageBoundary>
      </main>

      <Footer />
    </>
  );
}
