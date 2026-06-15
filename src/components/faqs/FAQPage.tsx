"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Search,
  Users,
  Store,
  Bike,
  Shield,
  Globe,
  Scale,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function FAQPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  // Helper to get FAQ items using flat keys
  const getFaqsForCategory = (prefix: string, count: number) => {
    const faqs = [];
    for (let i = 1; i <= count; i++) {
      faqs.push({
        question: t(`${prefix}_q${i}`),
        answer: t(`${prefix}_a${i}`),
      });
    }
    return faqs;
  };

  const faqCategories = [
    {
      id: "general",
      title: t("generalQuestions"),
      icon: Globe,
      faqs: getFaqsForCategory("general", 4),
    },
    {
      id: "customer",
      title: t("customerFaqs"),
      icon: Users,
      faqs: getFaqsForCategory("customer", 7),
    },
    {
      id: "merchant",
      title: t("merchantFaqs"),
      icon: Store,
      faqs: getFaqsForCategory("merchant", 5),
    },
    {
      id: "driver",
      title: t("driverFaqs"),
      icon: Bike,
      faqs: getFaqsForCategory("driver", 5),
    },
    {
      id: "paymentSecurity",
      title: t("paymentSecurityFaqs"),
      icon: Shield,
      faqs: getFaqsForCategory("security", 3),
    },
    {
      id: "liability",
      title: t("liabilityFaqs"),
      icon: Scale,
      faqs: getFaqsForCategory("liability", 3),
    },
  ];

  function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <span className="font-semibold text-slate-900">{question}</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <div className="border-t border-slate-100 px-5 py-4 text-slate-600">
            {answer}
          </div>
        )}
      </div>
    );
  }

  const filteredCategories = !search.trim()
    ? faqCategories
    : faqCategories
        .map((category) => ({
          ...category,
          faqs: category.faqs.filter(
            (faq) =>
              faq.question.toLowerCase().includes(search.toLowerCase()) ||
              faq.answer.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((category) => category.faqs.length > 0);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-[#E91E7F]">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            width={120}
            height={120}
            className="mx-auto mb-8 rounded-xl bg-white p-2"
          />
          <h1 className="text-4xl font-bold text-white md:text-6xl">
            {t("faqTitle")}
          </h1>
          <p className="mt-4 text-lg text-pink-100">{t("faqSubtitle")}</p>
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("faqSearchPlaceholder")}
                className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {faqCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.id}
                className="rounded-3xl border border-slate-200 p-6 transition hover:shadow-lg"
              >
                <Icon className="mb-4 h-8 w-8 text-[#E91E7F]" />
                <h3 className="mb-2 text-xl font-bold">{category.title}</h3>
                <p className="text-slate-500">
                  {category.faqs.length} {t("faqQuestions")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQs List */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="space-y-12">
          {filteredCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.id}>
                <div className="mb-6 flex items-center gap-3">
                  <Icon className="h-7 w-7 text-[#E91E7F]" />
                  <h2 className="text-3xl font-bold text-[#E91E7F]">
                    {category.title}
                  </h2>
                </div>
                <div className="space-y-4">
                  {category.faqs.map((faq, idx) => (
                    <FAQItem
                      key={`${category.id}-${idx}`}
                      question={faq.question}
                      answer={faq.answer}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}