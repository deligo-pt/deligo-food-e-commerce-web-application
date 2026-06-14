"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  Bike,
  Building2,
  ChartColumn,
  Clock3,
  Handshake,
  Leaf,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";

export default function AboutDeliGo() {
  const { t } = useTranslation();
  const services = [
    t("foodDelivery"),
    t("groceryDelivery"),
    t("courierParcelServices"),
    t("lastMileLogistics"),
    t("fleetManagementSolutions"),
    t("deligoRideMobilityPlatform"),
  ];

  const advantages = [
    {
      icon: <Store className="h-6 w-6" />,
      title: t("empoweringLocalBusinesses"),
      description: t("empoweringLocalBusinessesDescription"),
    },
    {
      icon: <Clock3 className="h-6 w-6" />,
      title: t("realTimeVisibility"),
      description: t("realTimeVisibilityDescription"),
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t("flexibleEarningOpportunities"),
      description: t("flexibleEarningOpportunitiesDescription"),
    },
    {
      icon: <Truck className="h-6 w-6" />,
      title: t("smartLogisticsNetwork"),
      description: t("smartLogisticsNetworkDescription"),
    },
    {
      icon: <ChartColumn className="h-6 w-6" />,
      title: t("businessGrowthPartner"),
      description: t("businessGrowthPartnerDescription"),
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: t("customerCentricInnovation"),
      description: t("customerCentricInnovationDescription"),
    },
    {
      icon: <Building2 className="h-6 w-6" />,
      title: t("dataDrivenDecisionMaking"),
      description: t("dataDrivenDecisionMakingDescription"),
    },
    {
      icon: <Package className="h-6 w-6" />,
      title: t("scalableInfrastructure"),
      description: t("scalableInfrastructureDescription"),
    },
    {
      icon: <Leaf className="h-6 w-6" />,
      title: t("sustainabilityCommitment"),
      description: t("sustainabilityCommitmentDescription"),
    },
    {
      icon: <Handshake className="h-6 w-6" />,
      title: t("communityImpact"),
      description: t("communityImpactDescription"),
    },
  ];

  const values = [
    {
      title: t("innovation"),
      text: t("innovationDescription"),
    },
    {
      title: t("reliability"),
      text: t("reliabilityDescription"),
    },
    {
      title: t("integrity"),
      text: t("integrityDescription"),
    },
    {
      title: t("customerSuccess"),
      text: t("customerSuccessDescription"),
    },
    {
      title: t("excellence"),
      text: t("excellenceDescription"),
    },
    {
      title: t("sustainability"),
      text: t("sustainabilityDescription"),
    },
  ];

  const missionItems = [
    t("missionItem1"),
    t("missionItem2"),
    t("missionItem3"),
    t("missionItem4"),
    t("missionItem5"),
    t("missionItem6"),
    t("missionItem7"),
  ];

  return (
    <main className="bg-white text-slate-800">
      {/* HERO */}
      <section className="bg-[#e91e7f] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            className="mx-auto mb-8 h-32 w-32 rounded-lg bg-white object-contain p-2 shadow-xl"
            width={128}
            height={128}
          />

          <h1 className="text-4xl font-bold md:text-6xl">{t("aboutDeligo")}</h1>

          <p className="mt-5 text-lg italic text-pink-100 md:text-2xl">
            {t("aboutHeroSubtitle")}
          </p>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-2xl border-l-4 border-[#e91e7f] bg-pink-50 p-8 md:p-10">
          <div className="space-y-6 text-lg leading-8 text-slate-700">
            <p>{t("aboutParagraph1")}</p>

            <p>{t("aboutParagraph2")}</p>

            <p>{t("aboutParagraph3")}</p>
          </div>
        </div>
      </section>

      {/* DIFFERENT */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <h2 className="mb-10 text-3xl font-bold text-[#e91e7f]">
          {t("whatMakesDeligoDifferent")}
        </h2>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Package className="h-6 w-6 text-[#e91e7f]" />
              <h3 className="text-2xl font-bold text-[#e91e7f]">
                {t("allInOneServiceEcosystem")}
              </h3>
            </div>

            <p className="mb-6 text-slate-600">{t("comprehensiveSuite")}</p>

            <ul className="space-y-3">
              {services.map((service) => (
                <li
                  key={service}
                  className="flex items-center gap-3 font-medium"
                >
                  <span className="h-2 w-2 rounded-full bg-[#e91e7f]" />
                  {service}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-[#e91e7f]" />
              <h3 className="text-2xl font-bold text-[#e91e7f]">
                {t("technologyDrivenOperations")}
              </h3>
            </div>

            <p className="text-lg leading-8 text-slate-600">
              {t("technologyDrivenOperationsDescription")}
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-[#e91e7f]">
            {t("aboutHeroSubtitle")}
          </h2>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {advantages.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 text-[#e91e7f]">{item.icon}</div>

                <h3 className="mb-3 text-xl font-bold">{item.title}</h3>

                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISION & MISSION */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
              {t("ourVision")}
            </h2>

            <p className="text-lg leading-8 text-slate-700">
              {t("ourVisionDescription")}
            </p>

            <div className="mt-12">
              <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
                {t("ourCoreValues")}
              </h2>

              <div className="space-y-5">
                {values.map((value) => (
                  <div key={value.title}>
                    <p className="text-lg">
                      <span className="font-bold">{value.title}</span> –{" "}
                      {value.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
              {t("ourMission")}
            </h2>

            <ul className="space-y-4">
              {missionItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#e91e7f]" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-12 flex justify-center">
              <Bike className="h-32 w-32 text-pink-200" />
            </div>
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-3xl bg-[#e91e7f] px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-4xl font-bold ">{t("deligoPromise")}</h2>

          <p className="mt-5 text-3xl font-bold italic">
            {t("deligoPromiseTagline")}
          </p>

          <p className="mx-auto mt-8 max-w-4xl text-lg leading-8 text-pink-100">
            {t("deligoPromiseDescription")}
          </p>
        </div>
      </section>
    </main>
  );
}
