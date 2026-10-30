import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import FCMProvider from "@/components/shared/FCMProvider";
import QueryProvider from "@/providers/QueryProvider";
import WebVitals from "@/components/shared/WebVitals";
import AppReadyMarker from "@/components/shared/AppReadyMarker";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "DeliGo, sempre contigo",
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
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var nav = performance.getEntriesByType('navigation')[0];
                  if (!nav || nav.type !== 'back_forward') return;
                  var key = 'deligo-bf-reload';
                  function recover() {
                    if (document.documentElement.hasAttribute('data-app-ready')) return;
                    if (sessionStorage.getItem(key) === location.href) return;
                    sessionStorage.setItem(key, location.href);
                    location.reload();
                  }
                  // An app script that fails to load means this copy of the
                  // page is stale: reload at once instead of waiting.
                  window.addEventListener('error', function(e) {
                    var el = e.target;
                    if (el && el.tagName === 'SCRIPT' && el.src && el.src.indexOf('/_next/') > -1) recover();
                  }, true);
                  setTimeout(recover, 5000);
                } catch (e) {}
              })();
            `,
          }}
        />
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
      <body className="min-h-full flex flex-col bg-[#f8f9fa] dark:bg-neutral-950 font-sans text-foreground dark:text-neutral-100 transition-colors duration-200">
        <QueryProvider>
          {children}
          <Toaster position="top-center" richColors />
          <FCMProvider />
          <WebVitals />
          <AppReadyMarker />
        </QueryProvider>
      </body>
    </html>
  );
}
