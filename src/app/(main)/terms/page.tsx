"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

export default function TermsPage() {
  const { t } = useTranslation();

  // Categories with static icons and translated names
  const categories = [
    { name: t("categoryRides"), icon: "🚗", href: "/terms/rides" },
    { name: t("categoryMicromobility"), icon: "🛴", href: "/terms/micromobility" },
    { name: t("categoryDeliGoDrive"), icon: "🚕", href: "/terms/drive" },
    { name: t("categoryDelivery"), icon: "🍔", href: "/terms/delivery" },
    { name: t("categoryInsurance"), icon: "🛡️", href: "/terms/insurance" },
    { name: t("categoryDeliGoBusiness"), icon: "💼", href: "/terms/business" },
    { name: t("categoryVendors"), icon: "🏪", href: "/terms/vendors" },
    { name: t("categoryOther"), icon: "📄", href: "/terms/other" },
  ];

  // Customer terms with static icons and translated titles/texts
  const customerTerms = [
    {
      icon: "👤",
      title: t("termAccountRegistrationTitle"),
      text: t("termAccountRegistrationText"),
    },
    {
      icon: "💳",
      title: t("termPaymentsFeesTitle"),
      text: t("termPaymentsFeesText"),
    },
    {
      icon: "🕒",
      title: t("termCancellationsRefundsTitle"),
      text: t("termCancellationsRefundsText"),
    },
    {
      icon: "📦",
      title: t("termDeliveryStandardsTitle"),
      text: t("termDeliveryStandardsText"),
    },
    {
      icon: "⚖️",
      title: t("termProhibitedConductTitle"),
      text: t("termProhibitedConductText"),
    },
    {
      icon: "🔒",
      title: t("termPrivacyTitle"),
      text: t("termPrivacyText"),
    },
    {
      icon: "🤝",
      title: t("termDisputeResolutionTitle"),
      text: t("termDisputeResolutionText"),
    },
    {
      icon: "✏️",
      title: t("termAmendmentsTitle"),
      text: t("termAmendmentsText"),
    },
  ];

  const CategoryCard = ({
    name,
    icon,
    href,
  }: {
    name: string;
    icon: string;
    href: string;
  }) => (
    <Link
      href={href}
      className="group bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xl font-semibold text-gray-800">{name}</span>
      </div>
      <p className="text-sm text-gray-500">Terms and Conditions</p>
    </Link>
  );

  const TermCard = ({
    icon,
    title,
    text,
  }: {
    icon: string;
    title: string;
    text: string;
  }) => (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xl">
          {icon}
        </div>
        <h4 className="text-xl font-semibold text-gray-800">{title}</h4>
      </div>
      <p className="text-gray-600 leading-relaxed">{text}</p>
    </div>
  );

  return (
    <main className="bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
            {t("termsHeroTitle")}
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Introduction */}
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl font-bold mb-4">{t("termsIntroTitle")}</h2>
          <p className="text-lg text-gray-600">{t("termsIntroDescription")}</p>
        </div>

        {/* Categories Grid */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-8 text-gray-700">
            {t("termsCategoriesHeading")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <CategoryCard key={cat.name} {...cat} />
            ))}
          </div>
        </section>

        {/* Customer Terms Section */}
        <section className="bg-white rounded-2xl shadow-md p-6 md:p-10 lg:p-12">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("termsCustomerSectionTitle")}
            </h2>
            <p className="text-gray-600">
              {t("termsCustomerSectionDescription")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customerTerms.map((term, idx) => (
              <TermCard key={idx} {...term} />
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-6">{t("termsContactSupportHelper")}</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition transform active:scale-95 shadow-md">
              {t("termsContactSupportButton")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}