"use client";

import { useState } from "react";
import {
  Search,
  MessageSquare,
  Mail,
  Phone,
  HelpCircle,
  ShoppingBag,
  CreditCard,
  User,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import ClearFilterButton from "@/components/shared/ClearFilterButton";

export default function HelpCenterPage() {
  const { t } = useTranslation();
  // Keyed by question text, not list index: the index shifts as the search
  // filters the list, which would silently move the open panel to another FAQ.
  // `null` = untouched, so the first visible question shows expanded.
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const contactItems = [
    {
      icon: MessageSquare,
      title: t("liveChat"),
      description: t("realTimeSupport"),
      action: t("startConversation"),
    },
    {
      icon: Mail,
      title: t("emailUs"),
      description: "contact@deligo.com",
      action: t("sendEmail"),
    },
    {
      icon: Phone,
      title: t("callUs"),
      description: "+351 920 136 680",
      action: t("callSupport"),
    },
  ];
  const categories = [
    {
      icon: HelpCircle,
      title: t("generalFaqs"),
      description: t("generalFaqsDescription"),
    },
    {
      icon: ShoppingBag,
      title: t("orderIssues"),
      description: t("orderIssuesDescription"),
    },
    {
      icon: CreditCard,
      title: t("paymentsRefunds"),
      description: t("paymentsRefundsDescription"),
    },
    {
      icon: User,
      title: t("accountProfile"),
      description: t("accountProfileDescription"),
    },
  ];
  const faqs = [
    {
      question: t("faqTrackOrderQuestion"),
      answer: t("faqTrackOrderAnswer"),
    },
    {
      question: t("faqDeliveryChargesQuestion"),
      answer: t("faqDeliveryChargesAnswer"),
    },
    {
      question: t("faqVoucherQuestion"),
      answer: t("faqVoucherAnswer"),
    },
  ];

  // The box above used to be decorative — it held no state and filtered
  // nothing. It now narrows both lists below on any visible text.
  const term = search.trim().toLowerCase();
  const matches = (...fields: string[]) =>
    !term || fields.some((f) => f.toLowerCase().includes(term));

  const filteredCategories = categories.filter((c) =>
    matches(c.title, c.description),
  );
  const filteredFaqs = faqs.filter((f) => matches(f.question, f.answer));
  const noMatches =
    !!term && filteredCategories.length === 0 && filteredFaqs.length === 0;

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {/* Header */}
        <section className="mb-14 text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#191c1d] dark:text-neutral-50">
            {t("helpCenter")}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm text-[#6b7280] dark:text-neutral-400 md:text-base">
            {t("helpCenterDescription")}
          </p>

          {/* Search */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#f9186b] dark:text-pink-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchHelpPlaceholder")}
              className="h-14 w-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-14 pr-11 text-sm shadow-sm outline-none transition-all focus:border-[#f9186b] dark:focus:border-pink-500 text-gray-900 dark:text-neutral-100"
            />

            {search && <ClearFilterButton onClear={() => setSearch("")} />}
          </div>

          {noMatches && (
            <p className="mt-6 text-sm text-[#6b7280] dark:text-neutral-400">
              {t("noResultsFound")}
            </p>
          )}

          {/* Banner */}
          <div className="relative mt-10 overflow-hidden rounded-3xl bg-[#f9186b] dark:bg-pink-600 p-6 text-left text-white shadow-lg md:flex md:items-center md:justify-between md:p-10">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-xl font-bold md:text-2xl">
                {t("needImmediateHelp")}
              </h2>

              <p className="mt-3 text-sm text-white/90 md:text-base">
                {t("needImmediateHelpDescription")}
              </p>
            </div>

            <button className="relative z-10 mt-5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#f9186b] dark:text-pink-600 transition hover:scale-105 md:mt-0 active:scale-95">
              {t("chatWithUsNow")}
            </button>

            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          </div>
        </section>

        {/* Contact */}
        <section className="mb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-[#191c1d] dark:text-neutral-50">
              {t("getInTouch")}
            </h2>

            <p className="mt-2 text-sm text-[#6b7280] dark:text-neutral-400">
              {t("getInTouchDescription")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {contactItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center shadow-sm dark:shadow-none transition-all hover:shadow-md"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 dark:bg-pink-950/40">
                    <Icon className="h-8 w-8 text-[#f9186b] dark:text-pink-400" />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-[#191c1d] dark:text-neutral-50">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-[#6b7280] dark:text-neutral-400">
                    {item.description}
                  </p>

                  <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#f9186b] dark:text-pink-400 hover:opacity-90 transition-opacity">
                    {item.action}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        {filteredCategories.length > 0 && (
        <section className="mb-16">
          <h2 className="mb-6 text-xl font-bold text-[#191c1d] dark:text-neutral-50">
            {t("browseByCategory")}
          </h2>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {filteredCategories.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="cursor-pointer rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm transition-all hover:border-[#f9186b]/30 dark:hover:border-pink-500/30 hover:shadow-md dark:hover:shadow-none"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/40">
                    <Icon className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-[#191c1d] dark:text-neutral-50">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-[#6b7280] dark:text-neutral-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* FAQ */}
        {filteredFaqs.length > 0 && (
        <section className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-[#191c1d] dark:text-neutral-50">
              {t("popularQuestions")}
            </h2>

            <p className="mt-2 text-sm text-[#6b7280] dark:text-neutral-400">
              {t("popularQuestionsDescription")}
            </p>
          </div>

          <div className="space-y-4">
            {filteredFaqs.map((faq, index) => {
              const isOpen =
                openFaq === null ? index === 0 : openFaq === faq.question;

              return (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? "" : faq.question)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="font-medium text-[#191c1d] dark:text-neutral-50">
                      {faq.question}
                    </span>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180 text-[#f9186b] dark:text-pink-400" : ""
                          }`}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6">
                      <div className="mb-5 h-px bg-gray-200 dark:bg-neutral-800" />

                      <p className="text-sm leading-7 text-[#6b7280] dark:text-neutral-400">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        )}
      </div>
    </div>
  );
}