"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Routes that are their own landing surface and shouldn't show a back control.
// Everything else under the (main) layout gets a consistent "go back" button so
// users never have to reach for the browser's back button.
const NO_BACK_ROUTES = new Set<string>(["/"]);

export default function PageBackBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  if (!pathname || NO_BACK_ROUTES.has(pathname)) return null;

  const handleBack = () => {
    // Prefer real history so users return to wherever they came from; fall back
    // to home when the page was opened directly (deep link, no in-app history).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="w-full px-4 pt-4 md:px-8">
      <button
        type="button"
        onClick={handleBack}
        aria-label={t("back")}
        className="group inline-flex items-center gap-1.5 rounded-full py-1.5 pr-3 text-sm font-semibold text-gray-600 transition-colors hover:text-[#f9186b] dark:text-neutral-400 dark:hover:text-[#f9186b]"
      >
        <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        {t("back")}
      </button>
    </div>
  );
}
