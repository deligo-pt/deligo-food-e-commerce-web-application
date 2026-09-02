"use client";
import VendorsGrid from "@/components/vendors/VendorsGrid";
import { useTranslation } from "@/hooks/useTranslation";

export default function VendorsPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-display font-bold text-foreground dark:text-neutral-100">{t("allVendors")}</h1>

        <p className="mt-2 text-muted-foreground dark:text-neutral-400">{t("browseAllVendors")}</p>
      </div>

      <VendorsGrid />
    </main>
  );
}
