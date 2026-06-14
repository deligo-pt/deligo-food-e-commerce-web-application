"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, Phone, MapPin, Globe } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function ContactPage() {
  const { t } = useTranslation();

  const contactCards = [
    {
      icon: Phone,
      title: t("contactCallTitle"),
      details: [t("contactCallDetail1"), t("contactCallDetail2")],
    },
    {
      icon: Mail,
      title: t("contactEmailTitle"),
      details: [t("contactEmailDetail1"), t("contactEmailDetail2")],
    },
    {
      icon: MapPin,
      title: t("contactVisitTitle"),
      details: [t("contactVisitDetail1"), t("contactVisitDetail2")],
    },
    {
      icon: Globe,
      title: t("contactWebsiteTitle"),
      details: [t("contactWebsiteDetail1")],
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-r from-[#E91E7F] via-[#f04297] to-[#E91E7F]">
        <div className="absolute inset-0 bg-black/5" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="mb-8 flex justify-center">
            <div className="rounded-3xl bg-white p-4 shadow-xl">
              <Image
                src="/deligo-logo.png"
                alt="DeliGo"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white md:text-6xl">
            {t("contactPageTitle")}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-pink-100 md:text-xl">
            {t("contactPageSubtitle")}
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {contactCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E91E7F]/10">
                  <Icon className="h-7 w-7 text-[#E91E7F]" />
                </div>

                <h3 className="mb-3 text-xl font-bold">{card.title}</h3>

                <div className="space-y-2 text-muted-foreground">
                  {card.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Location Card */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl bg-linear-to-r from-[#E91E7F] to-[#ff4da6] p-10 text-white">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <MapPin className="h-8 w-8" />
                <h2 className="text-3xl font-bold">{t("contactLocationTitle")}</h2>
              </div>

              <p className="mb-6 text-pink-100">
                {t("contactLocationDescription")}
              </p>

              <div className="space-y-2">
                <p className="font-semibold">{t("contactAddressLine1")}</p>
                <p>{t("contactAddressLine2")}</p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={`mailto:${t("contactEmailDetail1")}`}
                  className="rounded-xl bg-white px-6 py-3 font-medium text-[#E91E7F] transition hover:bg-pink-50"
                >
                  {t("contactEmailButton")}
                </Link>

                <Link
                  href={`https://wa.me/${t("contactCallDetail2").replace(/\s/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white px-6 py-3 font-medium text-white transition hover:bg-white/10"
                >
                  {t("contactWhatsAppButton")}
                </Link>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex h-72 w-full max-w-md items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
                <MapPin className="h-24 w-24 text-white/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl bg-linear-to-r from-[#E91E7F] via-[#f04297] to-[#E91E7F] px-8 py-14 text-center text-white">
            <h2 className="text-3xl font-bold md:text-4xl">{t("contactCtaTitle")}</h2>

            <p className="mx-auto mt-4 max-w-2xl text-pink-100">
              {t("contactCtaDescription")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-8">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <span>{t("contactEmailDetail1")}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <span>{t("contactCallDetail2")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}