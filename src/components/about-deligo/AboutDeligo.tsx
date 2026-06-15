"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  Bike,
  Building2,
  ChartColumn,
  Globe,
  Leaf,
  Package,
  Phone,
  ShieldCheck,
  Smartphone,
  Store,
  Zap,
} from "lucide-react";
import Image from "next/image";

export default function AboutDeliGo() {
  const { t } = useTranslation();

  const services = [
    t("superAppService1"),
    t("superAppService2"),
    t("superAppService3"),
    t("superAppService4"),
    t("superAppService5"),
    t("superAppService6"),
  ];

  const merchantBullets = [
    t("merchantBullet1"),
    t("merchantBullet2"),
    t("merchantBullet3"),
    t("merchantBullet4"),
    t("merchantBullet5"),
  ];

  const courierBullets = [
    t("courierBullet1"),
    t("courierBullet2"),
    t("courierBullet3"),
  ];

  return (
    <main className="bg-white text-slate-800">
      {/* Hero Section */}
      <section className="bg-[#e91e7f] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            className="mx-auto mb-8 h-32 w-32 rounded-lg bg-white object-contain p-2 shadow-xl"
            width={128}
            height={128}
          />
          <h1 className="text-4xl font-bold md:text-6xl">{t("aboutTitle")}</h1>
          <p className="mt-5 text-lg italic text-pink-100 md:text-2xl">
            {t("aboutSubtitle")}
          </p>
          <p className="mt-3 text-xl font-semibold text-pink-100 md:text-2xl">
            {t("aboutSlogan")}
          </p>
        </div>
      </section>

      {/* 1. Technology Marketplace Model */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
          {t("techMarketplaceTitle")}
        </h2>
        <div className="rounded-2xl border-l-4 border-[#e91e7f] bg-pink-50 p-8 md:p-10">
          <p className="text-lg leading-8 text-slate-700">
            {t("techMarketplaceText")}
          </p>
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 p-8">
          <h3 className="mb-3 text-2xl font-semibold text-[#e91e7f]">
            {t("regulatoryClarificationTitle")}
          </h3>
          <p className="text-lg leading-8 text-slate-700">
            {t("regulatoryClarificationText")}
          </p>
        </div>
      </section>

      {/* 2. Multi-Service Super App Architecture */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
            {t("superAppTitle")}
          </h2>
          <p className="mb-8 text-lg text-slate-700">{t("superAppIntro")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl bg-white p-5 shadow-sm"
              >
                <span className="mt-1 text-[#e91e7f]">
                  <Smartphone className="h-5 w-5" />
                </span>
                <span className="text-slate-700">{service}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center italic text-slate-500">
            {t("superAppFooter")}
          </p>
        </div>
      </section>

      {/* 3. Merchant Empowerment Toolkit */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
          {t("merchantTitle")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {merchantBullets.map((bullet, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Store className="mt-1 h-5 w-5 shrink-0 text-[#e91e7f]" />
              <span className="text-slate-700">{bullet}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Independent Courier Framework */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
            {t("courierTitle")}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {courierBullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl bg-white p-6 shadow-sm"
              >
                <Bike className="mt-1 h-5 w-5 shrink-0 text-[#e91e7f]" />
                <span className="text-slate-700">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Advanced Technology Infrastructure */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-10 text-3xl font-bold text-[#e91e7f]">
          {t("advancedTechTitle")}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border p-6 shadow-sm">
            <Zap className="mb-4 h-8 w-8 text-[#e91e7f]" />
            <h3 className="mb-3 text-xl font-bold">{t("aiSmartMatching")}</h3>
            <p className="text-slate-600">{t("aiSmartMatchingText")}</p>
          </div>
          <div className="rounded-2xl border p-6 shadow-sm">
            <Globe className="mb-4 h-8 w-8 text-[#e91e7f]" />
            <h3 className="mb-3 text-xl font-bold">
              {t("realTimeTransparency")}
            </h3>
            <p className="text-slate-600">{t("realTimeTransparencyText")}</p>
          </div>
          <div className="rounded-2xl border p-6 shadow-sm">
            <ChartColumn className="mb-4 h-8 w-8 text-[#e91e7f]" />
            <h3 className="mb-3 text-xl font-bold">{t("dataIntelligence")}</h3>
            <p className="text-slate-600">{t("dataIntelligenceText")}</p>
          </div>
        </div>
      </section>

      {/* 6. Scalability, Sustainability & Security */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-10 text-3xl font-bold text-[#e91e7f]">
            {t("scalabilityTitle")}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Building2 className="mb-4 h-8 w-8 text-[#e91e7f]" />
              <h3 className="mb-3 text-xl font-bold">
                {t("expansionStrategy")}
              </h3>
              <p className="text-slate-600">{t("expansionStrategyText")}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <Leaf className="mb-4 h-8 w-8 text-[#e91e7f]" />
              <h3 className="mb-3 text-xl font-bold">
                {t("sustainableInfra")}
              </h3>
              <p className="text-slate-600">{t("sustainableInfraText")}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <ShieldCheck className="mb-4 h-8 w-8 text-[#e91e7f]" />
              <h3 className="mb-3 text-xl font-bold">{t("secureProtocols")}</h3>
              <p className="text-slate-600">{t("secureProtocolsText")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Contacts */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-8 text-3xl font-bold text-[#e91e7f]">
          {t("contactsTitle")}
        </h2>
        <div className="grid gap-4 rounded-2xl bg-pink-50 p-8 md:grid-cols-2">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-[#e91e7f]" />
            <span>{t("website")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-[#e91e7f]" />
            <span>{t("supportEmail")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[#e91e7f]" />
            <span>{t("headquarters")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-[#e91e7f]" />
            <span>{t("whatsapp")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-[#e91e7f]" />
            <span>{t("telephone")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
