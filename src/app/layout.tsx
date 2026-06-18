import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import FCMProvider from "@/components/shared/FCMProvider";

export const metadata: Metadata = {
  title: "DeliGo | Fresh Delivery Right to Your Door",
  description: "Discover the best restaurants and local stores in Rua Augusta delivered right to your doorstep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="light h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#f8f9fa] font-sans text-[#191c1d]">
        {children}
        <Toaster position="top-center" richColors />
        <FCMProvider />
      </body>
    </html>
  );
}
