"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getTermsCategory } from "@/lib/termsCategories";

export default function TermsCategoryContent({ slug }: { slug: string }) {
  const { t } = useTranslation();

  // The server route already validated the slug, but guard defensively.
  const category = getTermsCategory(slug);
  if (!category) return null;

  return (
    <main className="bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Back to the categories index */}
        <Link
          href="/terms"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-neutral-400 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
        >
          <ArrowLeft size={16} />
          {t("termsBackToCategories")}
        </Link>

        {/* Hero */}
        <div className="mt-8 flex items-center gap-4">
          <span className="text-display">{category.icon}</span>
          <h1 className="text-2xl lg:text-display font-extrabold tracking-tight text-gray-900 dark:text-neutral-50">
            {t(category.titleKey)}
          </h1>
        </div>

        {/* Category-specific body */}
        <div className="mt-8 bg-white dark:bg-neutral-900 rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-neutral-800 p-6 md:p-10">
          <p className="text-base leading-relaxed text-gray-600 dark:text-neutral-300">
            {t(category.bodyKey)}
          </p>

          {/* These terms supplement the general customer terms */}
          <div className="mt-8 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 p-5">
            <p className="text-gray-600 dark:text-neutral-300 leading-relaxed">
              {t("termsCategorySupplementNote")}
            </p>
            <Link
              href="/terms"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline"
            >
              {t("termsViewGeneralTerms")}
            </Link>
          </div>
        </div>

        {/* CTA — consistent with the terms index */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-neutral-400 mb-6">{t("termsContactSupportHelper")}</p>
          <Link
            href="/contact-us"
            className="inline-block rounded-full bg-linear-to-r from-primary to-primary-hover px-8 py-3 font-bold text-white shadow-md transition hover:from-primary-hover hover:to-[#b01254] active:scale-95"
          >
            {t("termsContactSupportButton")}
          </Link>
        </div>
      </div>
    </main>
  );
}
