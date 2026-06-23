import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import FCMProvider from "@/components/shared/FCMProvider";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
      className={cn("light h-full antialiased", "font-sans", geist.variable)}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var themeState = localStorage.getItem('app-theme');
                  var theme = 'light';
                  if (themeState) {
                    var parsed = JSON.parse(themeState);
                    if (parsed && parsed.state && parsed.state.theme) {
                      theme = parsed.state.theme;
                    }
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#f8f9fa] dark:bg-neutral-950 font-sans text-[#191c1d] dark:text-neutral-100 transition-colors duration-200">
        {children}
        <Toaster position="top-center" richColors />
        <FCMProvider />
      </body>
    </html>
  );
}
