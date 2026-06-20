"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Ticket } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import VouchersSkeleton from "./VouchersSkeleton";
import { toast } from "sonner";

type Offer = {
  _id: string;
  title: string;
  description: string;
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
  const { t } = useTranslation();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "expired">(
    "available",
  );

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get<OffersResponse>("/offers");

        setOffers(response.data?.data ?? []);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load offers"));
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, []);

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
      toast.error("Failed to copy code");
    }
  };

  if (loading) {
    return <VouchersSkeleton />;
  }

  return (
    <section className="w-full bg-[#f8f9fa] px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="mb-2 text-[32px] font-bold text-[#191c1d]">
          {t("vouchers")}
        </h1>

        <p className="text-[#5a4044]">{t("vouchersDescription")}</p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-8 border-b border-[#e7e8e9]">
        <button
          onClick={() => setActiveTab("available")}
          className={`relative pb-4 text-sm font-semibold ${
            activeTab === "available" ? "text-[#b0004a]" : "text-[#5a4044]"
          }`}
        >
          {t("available")}
          {activeTab === "available" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#b0004a]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("expired")}
          className={`relative pb-4 text-sm font-semibold ${
            activeTab === "expired" ? "text-[#b0004a]" : "text-[#5a4044]"
          }`}
        >
          {t("expired")}
          {activeTab === "expired" && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#b0004a]" />
          )}
        </button>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {t("voucherError")}
        </div>
      )}

      {/* Empty Expired State */}
      {!loading &&
        !error &&
        activeTab === "expired" &&
        expiredOffers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-[#e7e8e9]">
              <Ticket size={60} className="text-gray-400" />
            </div>

            <h2 className="mb-2 text-2xl font-semibold text-[#191c1d]">
              {t("noExpiredVouchers")}
            </h2>

            <p className="max-w-sm text-[#5a4044]">
              {t("expiredVouchersDescription")}
            </p>
          </div>
        )}

      {/* Empty Available State */}
      {!loading &&
        !error &&
        activeTab === "available" &&
        availableOffers.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center">
            {t("noAvailableVouchers")}
          </div>
        )}

      {/* Cards */}
      {!loading && !error && displayedOffers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {displayedOffers.map((offer) => (
            <div
              key={offer._id}
              className="rounded-xl border border-[#f3f4f5] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_8px_30px_rgba(176,0,74,0.08)]"
            >
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#b0004a]">
                  <Ticket size={18} className="text-white" />
                </div>

                <div>
                  <h3 className="mb-1 text-lg font-semibold text-[#191c1d]">
                    {offer.title}
                  </h3>

                  <p className="text-sm text-[#5a4044]">{offer.description}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="rounded-lg border-2 border-dashed border-[#b0004a]/30 bg-[#b0004a]/5 px-4 py-2">
                  <span className="text-sm font-semibold tracking-widest text-[#b0004a]">
                    {offer.code}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(offer.code)}
                  className="rounded-lg bg-[#b0004a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d81b60]"
                >
                  {copiedCode === offer.code ? t("copied") : t("copy")}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#e7e8e9] pt-4">
                <div className="flex items-center gap-1 text-xs text-[#5a4044]">
                  <Clock3 size={12} />
                  <span>{getRemainingDays(offer.expiresAt)}</span>
                </div>

                <button className="text-xs text-[#b0004a] hover:underline">
                  {t("termsAndConditions")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
