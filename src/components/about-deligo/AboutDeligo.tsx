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
import Logo from "@/components/shared/Logo";

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
    <main className="bg-white dark:bg-neutral-950 text-slate-800 dark:text-neutral-200 transition-colors duration-200">
      {/* Hero Section */}
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center">
          {/* Hero is #e91e7f — the knockout puts the mark on the brand
              colour instead of boxing the tile in white. */}
          <Logo
            size={112}
            variant="mark"
            className="mx-auto mb-8 h-auto w-28"
          />
          <h1 className="text-display font-bold">{t("aboutTitle")}</h1>
          <p className="mt-4 text-base italic text-white/80 md:text-2xl">
            {t("aboutSubtitle")}
          </p>
          <p className="mt-3 text-xl font-semibold text-white/80 md:text-2xl">
            {t("aboutSlogan")}
          </p>
        </div>
      </section>

      {/* 1. Technology Marketplace Model */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
          {t("techMarketplaceTitle")}
        </h2>
        <div className="rounded-2xl border-l-4 border-primary bg-primary/5 dark:bg-pink-950/10 p-8 md:p-8">
          <p className="text-base leading-8 text-slate-700 dark:text-neutral-300">
            {t("techMarketplaceText")}
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-transparent dark:border-neutral-800 p-8">
          <h3 className="mb-3 text-2xl font-semibold text-primary">
            {t("regulatoryClarificationTitle")}
          </h3>
          <p className="text-base leading-8 text-slate-700 dark:text-neutral-300">
            {t("regulatoryClarificationText")}
          </p>
        </div>
      </section>

      {/* 2. Multi-Service Super App Architecture */}
      <section className="bg-slate-50 dark:bg-neutral-900 border-t border-b border-transparent dark:border-neutral-800/80 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
            {t("superAppTitle")}
          </h2>
          <p className="mb-8 text-base text-slate-700 dark:text-neutral-300">{t("superAppIntro")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl bg-white dark:bg-neutral-950 border border-transparent dark:border-neutral-800/50 p-4 shadow-sm dark:shadow-none"
              >
                <span className="mt-1 text-primary">
                  <Smartphone className="h-5 w-5" />
                </span>
                <span className="text-slate-700 dark:text-neutral-300">{service}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center italic text-slate-500 dark:text-neutral-400">
            {t("superAppFooter")}
          </p>
        </div>
      </section>

      {/* 3. Merchant Empowerment Toolkit */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
          {t("merchantTitle")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {merchantBullets.map((bullet, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Store className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <span className="text-slate-700 dark:text-neutral-300">{bullet}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Independent Courier Framework */}
      <section className="bg-slate-50 dark:bg-neutral-900 border-t border-b border-transparent dark:border-neutral-800/80 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
            {t("courierTitle")}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {courierBullets.map((bullet, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl bg-white dark:bg-neutral-950 border border-transparent dark:border-neutral-800/50 p-6 shadow-sm dark:shadow-none"
              >
                <Bike className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <span className="text-slate-700 dark:text-neutral-300">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Advanced Technology Infrastructure */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
          {t("advancedTechTitle")}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-sm dark:shadow-none">
            <Zap className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">{t("aiSmartMatching")}</h3>
            <p className="text-slate-600 dark:text-neutral-400">{t("aiSmartMatchingText")}</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm dark:shadow-none">
            <Globe className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">
              {t("realTimeTransparency")}
            </h3>
            <p className="text-slate-600 dark:text-neutral-400">{t("realTimeTransparencyText")}</p>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm dark:shadow-none">
            <ChartColumn className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">{t("dataIntelligence")}</h3>
            <p className="text-slate-600 dark:text-neutral-400">{t("dataIntelligenceText")}</p>
          </div>
        </div>
      </section>

      {/* 6. Scalability, Sustainability & Security */}
      <section className="bg-slate-50 dark:bg-neutral-900 border-t border-b border-transparent dark:border-neutral-800/80 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
            {t("scalabilityTitle")}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-transparent dark:border-neutral-800/50 p-6 shadow-sm dark:shadow-none">
              <Building2 className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">
                {t("expansionStrategy")}
              </h3>
              <p className="text-slate-600 dark:text-neutral-400">{t("expansionStrategyText")}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-transparent dark:border-neutral-800/50 p-6 shadow-sm dark:shadow-none">
              <Leaf className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">
                {t("sustainableInfra")}
              </h3>
              <p className="text-slate-600 dark:text-neutral-400">{t("sustainableInfraText")}</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-transparent dark:border-neutral-800/50 p-6 shadow-sm dark:shadow-none">
              <ShieldCheck className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-neutral-100">{t("secureProtocols")}</h3>
              <p className="text-slate-600 dark:text-neutral-400">{t("secureProtocolsText")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Contacts */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-6 text-2xl lg:text-display font-bold text-primary">
          {t("contactsTitle")}
        </h2>
        <div className="grid gap-4 rounded-2xl bg-primary/5 dark:bg-pink-950/10 border border-transparent dark:border-pink-900/10 p-8 md:grid-cols-2 text-slate-700 dark:text-neutral-300">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <span>{t("website")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <span>{t("supportEmail")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <span>{t("headquarters")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <span>{t("whatsapp")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <span>{t("telephone")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
