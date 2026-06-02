import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

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
      className={`${plusJakartaSans.variable} light h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f8f9fa] font-sans text-[#191c1d]">
        {children}
      </body>
    </html>
  );
}
