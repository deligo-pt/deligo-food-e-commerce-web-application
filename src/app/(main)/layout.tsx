import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import LocationPromptModalLazy from "@/components/shared/LocationPromptModalLazy";
import SupportChatDialogLazy from "@/components/support/SupportChatDialogLazy";
import LanguageBoundary from "@/components/shared/LanguageBoundary";
import PageBackBar from "@/components/shared/PageBackBar";

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

      <main className="flex-1">
        <PageBackBar />
        <LanguageBoundary>{children}</LanguageBoundary>
      </main>

      <Footer />
    </>
  );
}
