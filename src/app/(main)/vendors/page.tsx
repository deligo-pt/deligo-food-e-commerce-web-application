"use client";
import VendorsGrid from "@/components/vendors/VendorsGrid";
import { useTranslation } from "@/hooks/useTranslation";

export default function VendorsPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[#191c1d] dark:text-neutral-100">{t("allVendors")}</h1>

        <p className="mt-2 text-[#5a4044] dark:text-neutral-400">{t("browseAllVendors")}</p>
      </div>

      <VendorsGrid />
    </main>
  );
}
