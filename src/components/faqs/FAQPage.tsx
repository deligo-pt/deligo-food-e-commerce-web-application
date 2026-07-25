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
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <span className="font-semibold text-slate-900 dark:text-neutral-100">{question}</span>
          <ChevronDown
            className={`h-5 w-5 text-slate-400 dark:text-neutral-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open && (
          <div className="border-t border-slate-100 dark:border-neutral-800 px-5 py-4 text-slate-600 dark:text-neutral-300 bg-slate-50/50 dark:bg-neutral-950/20">
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
    <main className="min-h-screen bg-white dark:bg-neutral-950 text-slate-800 dark:text-neutral-200 transition-colors duration-200">
      {/* Hero. Contained and rounded rather than full-bleed so it sits below the
          shared back bar instead of butting against it (same as the contact
          page). */}
      <section className="mx-auto max-w-7xl px-4 pt-2 md:px-8">
        <div className="rounded-3xl bg-linear-to-r from-[#f9186b] via-[#d4145b] to-[#f9186b] px-6 py-16 text-center md:py-20">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            width={120}
            height={120}
            className="mx-auto mb-8 rounded-xl bg-white p-2"
          />
          <h1 className="text-3xl font-bold text-white sm:text-4xl md:text-6xl">
            {t("faqTitle")}
          </h1>
          <p className="mt-4 text-base text-white/85 md:text-lg">
            {t("faqSubtitle")}
          </p>
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("faqSearchPlaceholder")}
                className="h-14 w-full rounded-2xl border-0 bg-white dark:bg-neutral-900 pl-12 pr-4 text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-[#f9186b]/30"
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
                className="rounded-3xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 transition hover:shadow-lg dark:hover:shadow-none dark:hover:bg-neutral-800/30"
              >
                <Icon className="mb-4 h-8 w-8 text-[#f9186b]" />
                <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-neutral-100">{category.title}</h3>
                <p className="text-slate-500 dark:text-neutral-400">
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
                  <Icon className="h-7 w-7 text-[#f9186b]" />
                  <h2 className="text-3xl font-bold text-[#f9186b]">
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