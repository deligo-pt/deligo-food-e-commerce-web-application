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

export default function HelpCenterPage() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number>(0);

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

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        {/* Header */}
        <section className="mb-14 text-center">
          <h1 className="text-3xl font-bold text-[#191c1d] dark:text-neutral-50 md:text-4xl">
            {t("helpCenter")}
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm text-[#6b7280] dark:text-neutral-400 md:text-base">
            {t("helpCenterDescription")}
          </p>

          {/* Search */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#d81b60] dark:text-pink-400" />

            <input
              type="text"
              placeholder={t("searchHelpPlaceholder")}
              className="h-14 w-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 pl-14 pr-4 text-sm shadow-sm outline-none transition-all focus:border-[#d81b60] dark:focus:border-pink-500 text-gray-900 dark:text-neutral-100"
            />
          </div>

          {/* Banner */}
          <div className="relative mt-10 overflow-hidden rounded-3xl bg-[#d81b60] dark:bg-pink-600 p-6 text-left text-white shadow-lg md:flex md:items-center md:justify-between md:p-10">
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-xl font-bold md:text-2xl">
                {t("needImmediateHelp")}
              </h2>

              <p className="mt-3 text-sm text-white/90 md:text-base">
                {t("needImmediateHelpDescription")}
              </p>
            </div>

            <button className="relative z-10 mt-5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#d81b60] dark:text-pink-600 transition hover:scale-105 md:mt-0 active:scale-95">
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
                    <Icon className="h-8 w-8 text-[#d81b60] dark:text-pink-400" />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-[#191c1d] dark:text-neutral-50">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-[#6b7280] dark:text-neutral-400">
                    {item.description}
                  </p>

                  <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#d81b60] dark:text-pink-400 hover:opacity-90 transition-opacity">
                    {item.action}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        <section className="mb-16">
          <h2 className="mb-6 text-xl font-bold text-[#191c1d] dark:text-neutral-50">
            {t("browseByCategory")}
          </h2>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {categories.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="cursor-pointer rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm transition-all hover:border-[#d81b60]/30 dark:hover:border-pink-500/30 hover:shadow-md dark:hover:shadow-none"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/40">
                    <Icon className="h-5 w-5 text-[#d81b60] dark:text-pink-400" />
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

        {/* FAQ */}
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
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="font-medium text-[#191c1d] dark:text-neutral-50">
                      {faq.question}
                    </span>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180 text-[#d81b60] dark:text-pink-400" : ""
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
      </div>
    </div>
  );
}