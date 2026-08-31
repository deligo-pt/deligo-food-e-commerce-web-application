"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Ticket } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveLocalized, type LocalizedField } from "@/lib/localizedField";
import { useStore } from "@/stores/translationStore";
import VouchersSkeleton from "./VouchersSkeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";

type Offer = {
  _id: string;
  // This endpoint ignores the Accept-Language header and returns the raw
  // bilingual document, so these must go through `resolveLocalized` before
  // they reach JSX.
  title: LocalizedField;
  description: LocalizedField;
  code: string;
  expiresAt: string;
  offerType: string;
  discountValue: number;
  isActive: boolean;
  isDeleted: boolean;
};

type OffersResponse = {
  success: boolean;
  message: string;
  data: Offer[];
};

export default function VouchersPageContent() {
  const { t, langVersion } = useTranslation();
  const lang = useStore((s) => s.lang);
  const prevLangVersionRef = useRef(langVersion);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "expired">(
    "available",
  );

  useEffect(() => {
    const isLangChange = prevLangVersionRef.current !== langVersion;
    prevLangVersionRef.current = langVersion;

    const fetchOffers = async () => {
      try {
        // Keep the current offers visible while re-fetching for a language switch.
        if (!isLangChange) setLoading(true);
        setError("");

        const response = await apiClient.get<OffersResponse>("/offers");

        // The list is filtered during render, where a try/catch can't reach —
        // so a non-array payload has to be rejected here, not there.
        const payload = response.data?.data;
        setOffers(Array.isArray(payload) ? payload : []);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load offers"));
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, [langVersion]);

  const availableOffers = useMemo(() => {
    return offers.filter(
      (offer) => offer.isActive === true && offer.isDeleted === false,
    );
  }, [offers]);

  const expiredOffers = useMemo(() => {
    return offers.filter(
      (offer) => offer.isActive === false || offer.isDeleted === true,
    );
  }, [offers]);

  const displayedOffers =
    activeTab === "available" ? availableOffers : expiredOffers;

  const getRemainingDays = (expiresAt: string): string => {
    const today = new Date();
    const expiry = new Date(expiresAt);

    const diff = expiry.getTime() - today.getTime();

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return "Expired";
    }

    if (days === 1) {
      return "Expires in 1 day";
    }

    return `Expires in ${days} days`;
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);

      setCopiedCode(code);

      toast.success(`Copied: ${code}`);

      setTimeout(() => {
        setCopiedCode("");
      }, 2000);
    } catch {
      toast.error(t("failedToCopyCode"));
    }
  };

  if (loading) {
    return <VouchersSkeleton />;
  }

  return (
    <section className="w-full bg-[#f8f9fa] dark:bg-neutral-950 px-8 py-12 min-h-screen transition-colors duration-200">
      {/* Header */}
      <div className="mb-10">
        <h1 className="mb-2 text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
          {t("vouchers")}
        </h1>

        <p className="text-muted-foreground dark:text-neutral-400">{t("vouchersDescription")}</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-8 border-b border-[#e7e8e9] dark:border-neutral-800">
        <button
          onClick={() => setActiveTab("available")}
          className={`focus-ring relative pb-4 text-sm font-semibold transition-colors duration-150 ${
            activeTab === "available"
              ? "text-primary dark:text-pink-500"
              : "text-muted-foreground dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          }`}
        >
          {t("available")}
          {activeTab === "available" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary dark:bg-pink-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("expired")}
          className={`focus-ring relative pb-4 text-sm font-semibold transition-colors duration-150 ${
            activeTab === "expired"
              ? "text-primary dark:text-pink-500"
              : "text-muted-foreground dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          }`}
        >
          {t("expired")}
          {activeTab === "expired" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary dark:bg-pink-500" />
          )}
        </button>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 dark:border-red-950/30 bg-red-50 dark:bg-red-950/15 p-4 text-red-600 dark:text-red-400">
          {t("failedToLoadOffers")}
        </div>
      )}

      {/* Empty Expired State */}
      {!loading &&
        !error &&
        activeTab === "expired" &&
        expiredOffers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
            <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#e7e8e9] dark:bg-neutral-800">
              <Ticket size={60} className="text-gray-400 dark:text-neutral-500" />
            </div>

            <h2 className="mb-2 text-xl font-semibold text-foreground dark:text-neutral-50">
              {t("noExpiredVouchers")}
            </h2>

            <p className="max-w-sm text-muted-foreground dark:text-neutral-400">
              {t("noExpiredVouchersDescription")}
            </p>
          </div>
        )}

      {/* Empty Available State */}
      {!loading &&
        !error &&
        activeTab === "available" &&
        availableOffers.length === 0 && (
          <div
            className={cn(
              cardVariants(),
              "animate-fadeIn p-8 text-center text-gray-900 dark:text-neutral-100",
            )}
          >
            {t("noAvailableVouchers")}
          </div>
        )}

      {/* Cards */}
      {!loading && !error && displayedOffers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 animate-fadeIn">
          {displayedOffers.map((offer) => (
            <div
              key={offer._id}
              /* Phase 8. A sixth shell, with its own radius, its own hex
                 border and two hand-mixed shadows — one of them a pink-tinted
                 hover that no other card in the app has. */
              className={cn(
                cardVariants({ variant: "interactive", padding: "card" }),
              )}
            >
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary dark:bg-pink-600">
                  <Ticket size={18} className="text-white" />
                </div>

                <div>
                  <h3 className="mb-1 text-xl font-semibold text-foreground dark:text-neutral-50">
                    {resolveLocalized(offer.title, lang)}
                  </h3>

                  <p className="text-sm text-muted-foreground dark:text-neutral-400">
                    {resolveLocalized(offer.description, lang)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="rounded-lg border-2 border-dashed border-primary/30 dark:border-pink-500/30 bg-primary/5 dark:bg-pink-500/10 px-4 py-2">
                  <span className="text-sm font-semibold tracking-widest text-primary dark:text-pink-400">
                    {offer.code}
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleCopy(offer.code)}
                  className="font-semibold"
                >
                  {copiedCode === offer.code ? t("copied") : t("copy")}
                </Button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#e7e8e9] dark:border-neutral-800 pt-4">
                <div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-neutral-400">
                  <Clock3 size={12} />
                  <span>{getRemainingDays(offer.expiresAt)}</span>
                </div>

                <Button variant="link" size="sm" className="h-auto px-0 text-xs">
                  {t("termsAndConditions")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
